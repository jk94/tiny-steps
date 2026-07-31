import { Prisma, User } from '@prisma/client';
import * as client from 'openid-client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthResult, AuthService } from '../auth.service';
import { OidcProviderEntry, OidcProviderRegistry } from './oidc-provider-registry.service';
import { OidcMappingError, OidcService } from './oidc.service';

jest.mock('openid-client', () => ({
  authorizationCodeGrant: jest.fn(),
  fetchUserInfo: jest.fn(),
  randomState: jest.fn(() => 'random-state'),
  randomNonce: jest.fn(() => 'random-nonce'),
  randomPKCECodeVerifier: jest.fn(() => 'random-code-verifier'),
  calculatePKCECodeChallenge: jest.fn(async () => 'random-code-challenge'),
  buildAuthorizationUrl: jest.fn(),
}));

const mockedAuthorizationCodeGrant = client.authorizationCodeGrant as jest.Mock;
const mockedFetchUserInfo = client.fetchUserInfo as jest.Mock;

const PROVIDER_ID = 'keycloak';
const SUBJECT = 'oidc-subject-1';

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'parent@example.com',
  passwordHash: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const buildEntry = (): OidcProviderEntry => ({
  config: {
    id: PROVIDER_ID,
    displayName: 'Keycloak',
    issuer: 'https://keycloak.example.com/realms/family',
    clientId: 'baby-tracker',
    clientSecret: 'secret',
    scopes: ['openid', 'profile', 'email'],
  },
  oidcConfig: { name: 'oidc-config' } as unknown as client.Configuration,
});

/** Simulates the token response `authorizationCodeGrant()` resolves with. */
const buildTokenResponse = (subject: string, idTokenClaims: Record<string, unknown> = {}) => ({
  access_token: 'access-token-value',
  token_type: 'bearer' as const,
  claims: () => ({ sub: subject, ...idTokenClaims }),
});

describe('OidcService', () => {
  let prisma: {
    oidcIdentity: { findUnique: jest.Mock; create: jest.Mock };
    user: { findUnique: jest.Mock; create: jest.Mock };
  };
  let registry: { get: jest.Mock };
  let authService: { issueSessionFor: jest.Mock };
  let service: OidcService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      oidcIdentity: { findUnique: jest.fn(), create: jest.fn() },
      user: { findUnique: jest.fn(), create: jest.fn() },
    };
    registry = { get: jest.fn() };
    authService = { issueSessionFor: jest.fn() };
    service = new OidcService(
      registry as unknown as OidcProviderRegistry,
      prisma as unknown as PrismaService,
      authService as unknown as AuthService,
    );
  });

  describe('handleCallback', () => {
    it('returns undefined when the provider is unknown', async () => {
      registry.get.mockReturnValue(undefined);

      const result = await service.handleCallback('unknown', new URL('http://localhost/'), {
        state: 's',
        nonce: 'n',
        codeVerifier: 'c',
      });

      expect(result).toBeUndefined();
      expect(mockedAuthorizationCodeGrant).not.toHaveBeenCalled();
    });

    it('creates a new User + OidcIdentity for a brand-new (providerId, subject) with no matching email', async () => {
      registry.get.mockReturnValue(buildEntry());
      mockedAuthorizationCodeGrant.mockResolvedValue(buildTokenResponse(SUBJECT));
      mockedFetchUserInfo.mockResolvedValue({ sub: SUBJECT, email: 'new@example.com' });
      prisma.oidcIdentity.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      const createdUser = buildUser({ id: 'new-user', email: 'new@example.com' });
      prisma.user.create.mockResolvedValue(createdUser);
      prisma.oidcIdentity.create.mockResolvedValue({
        id: 'identity-1',
        userId: createdUser.id,
        providerId: PROVIDER_ID,
        subject: SUBJECT,
        createdAt: new Date(),
      });
      const authResult: AuthResult = {
        user: { id: createdUser.id, email: createdUser.email, createdAt: createdUser.createdAt },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      };
      authService.issueSessionFor.mockResolvedValue(authResult);

      const result = await service.handleCallback(PROVIDER_ID, new URL('http://localhost/'), {
        state: 's',
        nonce: 'n',
        codeVerifier: 'c',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: 'new@example.com', passwordHash: null },
      });
      expect(prisma.oidcIdentity.create).toHaveBeenCalledWith({
        data: { userId: 'new-user', providerId: PROVIDER_ID, subject: SUBJECT },
      });
      expect(authService.issueSessionFor).toHaveBeenCalledTimes(1);
      expect(authService.issueSessionFor).toHaveBeenCalledWith(createdUser);
      expect(result).toBe(authResult);
    });

    it('resolves the email from the ID Token claims when present, skipping the UserInfo round trip entirely', async () => {
      registry.get.mockReturnValue(buildEntry());
      mockedAuthorizationCodeGrant.mockResolvedValue(
        buildTokenResponse(SUBJECT, { email: 'from-id-token@example.com' }),
      );
      prisma.oidcIdentity.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      const createdUser = buildUser({ id: 'new-user', email: 'from-id-token@example.com' });
      prisma.user.create.mockResolvedValue(createdUser);
      prisma.oidcIdentity.create.mockResolvedValue({
        id: 'identity-1',
        userId: createdUser.id,
        providerId: PROVIDER_ID,
        subject: SUBJECT,
        createdAt: new Date(),
      });
      authService.issueSessionFor.mockResolvedValue({
        user: { id: createdUser.id, email: createdUser.email, createdAt: createdUser.createdAt },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      });

      await service.handleCallback(PROVIDER_ID, new URL('http://localhost/'), {
        state: 's',
        nonce: 'n',
        codeVerifier: 'c',
      });

      expect(mockedFetchUserInfo).not.toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: 'from-id-token@example.com', passwordHash: null },
      });
    });

    it('short-circuits on an existing OidcIdentity: resolves the linked User directly, no email lookup', async () => {
      registry.get.mockReturnValue(buildEntry());
      mockedAuthorizationCodeGrant.mockResolvedValue(buildTokenResponse(SUBJECT));
      const linkedUser = buildUser({ id: 'linked-user' });
      prisma.oidcIdentity.findUnique.mockResolvedValue({
        id: 'identity-1',
        userId: linkedUser.id,
        providerId: PROVIDER_ID,
        subject: SUBJECT,
        createdAt: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue(linkedUser);
      authService.issueSessionFor.mockResolvedValue({
        user: { id: linkedUser.id, email: linkedUser.email, createdAt: linkedUser.createdAt },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      });

      await service.handleCallback(PROVIDER_ID, new URL('http://localhost/'), {
        state: 's',
        nonce: 'n',
        codeVerifier: 'c',
      });

      expect(mockedFetchUserInfo).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.oidcIdentity.create).not.toHaveBeenCalled();
      expect(authService.issueSessionFor).toHaveBeenCalledWith(linkedUser);
    });

    it('auto-links unconditionally to an existing User by email match, with no email_verified inspection', async () => {
      registry.get.mockReturnValue(buildEntry());
      mockedAuthorizationCodeGrant.mockResolvedValue(buildTokenResponse(SUBJECT));
      // Deliberately unverified/absent email_verified — the point of this test.
      mockedFetchUserInfo.mockResolvedValue({
        sub: SUBJECT,
        email: 'Existing@Example.com',
        email_verified: false,
      });
      prisma.oidcIdentity.findUnique.mockResolvedValue(null);
      const existingUser = buildUser({ id: 'existing-user', email: 'existing@example.com' });
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.oidcIdentity.create.mockResolvedValue({
        id: 'identity-1',
        userId: existingUser.id,
        providerId: PROVIDER_ID,
        subject: SUBJECT,
        createdAt: new Date(),
      });
      authService.issueSessionFor.mockResolvedValue({
        user: { id: existingUser.id, email: existingUser.email, createdAt: existingUser.createdAt },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      });

      await service.handleCallback(PROVIDER_ID, new URL('http://localhost/'), {
        state: 's',
        nonce: 'n',
        codeVerifier: 'c',
      });

      // Normalized (trimmed/lowercased) email used for the lookup.
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'existing@example.com' },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.oidcIdentity.create).toHaveBeenCalledWith({
        data: { userId: existingUser.id, providerId: PROVIDER_ID, subject: SUBJECT },
      });
      expect(authService.issueSessionFor).toHaveBeenCalledWith(existingUser);
    });

    it('throws a mapped email_required error when the email claim is missing, creating no rows', async () => {
      registry.get.mockReturnValue(buildEntry());
      mockedAuthorizationCodeGrant.mockResolvedValue(buildTokenResponse(SUBJECT));
      mockedFetchUserInfo.mockResolvedValue({ sub: SUBJECT });
      prisma.oidcIdentity.findUnique.mockResolvedValue(null);

      await expect(
        service.handleCallback(PROVIDER_ID, new URL('http://localhost/'), {
          state: 's',
          nonce: 'n',
          codeVerifier: 'c',
        }),
      ).rejects.toMatchObject({ code: 'email_required' } satisfies Partial<OidcMappingError>);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.oidcIdentity.create).not.toHaveBeenCalled();
      expect(authService.issueSessionFor).not.toHaveBeenCalled();
    });

    it('maps a concurrent P2002 race on user creation to email_in_use, leaving no partial OidcIdentity row', async () => {
      registry.get.mockReturnValue(buildEntry());
      mockedAuthorizationCodeGrant.mockResolvedValue(buildTokenResponse(SUBJECT));
      mockedFetchUserInfo.mockResolvedValue({ sub: SUBJECT, email: 'race@example.com' });
      prisma.oidcIdentity.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.handleCallback(PROVIDER_ID, new URL('http://localhost/'), {
          state: 's',
          nonce: 'n',
          codeVerifier: 'c',
        }),
      ).rejects.toMatchObject({ code: 'email_in_use' } satisfies Partial<OidcMappingError>);

      expect(prisma.oidcIdentity.create).not.toHaveBeenCalled();
      expect(authService.issueSessionFor).not.toHaveBeenCalled();
    });
  });

  describe('buildLoginRedirect', () => {
    it('returns undefined when the provider is unknown', async () => {
      registry.get.mockReturnValue(undefined);

      const result = await service.buildLoginRedirect('unknown');

      expect(result).toBeUndefined();
    });

    it('builds an authorization URL and returns the txn to persist in the oidc_txn cookie', async () => {
      registry.get.mockReturnValue(buildEntry());
      (client.buildAuthorizationUrl as jest.Mock).mockReturnValue(
        new URL('https://keycloak.example.com/auth?state=random-state'),
      );

      const result = await service.buildLoginRedirect(PROVIDER_ID);

      expect(result).toEqual({
        authorizationUrl: 'https://keycloak.example.com/auth?state=random-state',
        txn: {
          providerId: PROVIDER_ID,
          state: 'random-state',
          nonce: 'random-nonce',
          codeVerifier: 'random-code-verifier',
        },
      });
    });
  });
});
