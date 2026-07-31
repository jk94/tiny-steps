import { webcrypto } from 'crypto';
import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import nock from 'nock';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CSRF_COOKIE_NAME } from '../src/auth/guards/csrf.guard';
import { OIDC_TXN_COOKIE_NAME } from '../src/auth/oidc/oidc-transaction-cookie.service';
import { PrismaService } from '../src/prisma/prisma.service';

const fixture = (name: string) => join(__dirname, '__fixtures__', name);

const ISSUER = 'https://idp.oidc.e2e.test';
const ISSUER_TWO = 'https://idp-two.oidc.e2e.test';
const CLIENT_ID = 'e2e-client';
const PROVIDER_ID = 'fake-idp';

/** Finds one cookie's `name=value` pair (with attributes) from a Set-Cookie header array. */
function findSetCookie(setCookie: string[] | undefined, name: string): string | undefined {
  return (setCookie ?? []).find((raw) => raw.startsWith(`${name}=`));
}

function base64url(input: Uint8Array | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : Buffer.from(input);
  return buf.toString('base64url');
}

/** Minimal RS256 signing keypair + JWK export — no need for a real IdP or an extra JWT library. */
async function generateSigningKey(): Promise<{
  privateKey: CryptoKey;
  jwk: JsonWebKey & { kid: string };
}> {
  const { publicKey, privateKey } = await webcrypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const publicJwk = (await webcrypto.subtle.exportKey('jwk', publicKey)) as JsonWebKey;
  return { privateKey, jwk: { ...publicJwk, kid: 'e2e-signing-key', alg: 'RS256', use: 'sig' } };
}

async function signIdToken(
  privateKey: CryptoKey,
  kid: string,
  claims: Record<string, unknown>,
): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = await webcrypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    Buffer.from(signingInput),
  );
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

function discoveryDocument(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['openid', 'profile', 'email'],
  };
}

describe('OIDC (e2e)', () => {
  const originalEnv = {
    CONFIG_PATH: process.env.CONFIG_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    PUBLIC_URL: process.env.PUBLIC_URL,
  };

  const E2E_EMAIL_DOMAIN = '@oidc.e2e.test';
  const testEmail = (label: string) =>
    `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}${E2E_EMAIL_DOMAIN}`;

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signingKey: { privateKey: CryptoKey; jwk: JsonWebKey & { kid: string } };

  beforeAll(async () => {
    signingKey = await generateSigningKey();

    // Discovery + JWKS are fetched once at OnModuleInit and cached for the
    // app's lifetime (see `OidcProviderRegistry`) — `.persist()` so the
    // interceptors survive across every test in this file.
    nock(ISSUER)
      .persist()
      .get('/.well-known/openid-configuration')
      .reply(200, discoveryDocument(ISSUER));
    nock(ISSUER)
      .persist()
      .get('/jwks')
      .reply(200, { keys: [signingKey.jwk] });
    nock(ISSUER_TWO)
      .persist()
      .get('/.well-known/openid-configuration')
      .reply(200, discoveryDocument(ISSUER_TWO));
    nock(ISSUER_TWO).persist().get('/jwks').reply(200, { keys: [] });

    process.env.CONFIG_PATH = fixture('oidc.config.yml');
    // Reuses the real dev SQLite DB (already migrated), matching every
    // other e2e spec's convention — rows created here are cleaned up in
    // afterEach.
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    process.env.JWT_ACCESS_SECRET = 'e2e-test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'e2e-test-refresh-secret';
    process.env.PUBLIC_URL = 'http://localhost:3000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    nock.cleanAll();
    nock.restore();
    process.env.CONFIG_PATH = originalEnv.CONFIG_PATH;
    process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    process.env.JWT_ACCESS_SECRET = originalEnv.JWT_ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = originalEnv.JWT_REFRESH_SECRET;
    process.env.PUBLIC_URL = originalEnv.PUBLIC_URL;
  });

  afterEach(async () => {
    // FK order: OidcIdentity -> User (RefreshToken also -> User).
    await prisma.oidcIdentity.deleteMany({
      where: { user: { email: { endsWith: E2E_EMAIL_DOMAIN } } },
    });
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { endsWith: E2E_EMAIL_DOMAIN } } },
    });
    await prisma.user.deleteMany({ where: { email: { endsWith: E2E_EMAIL_DOMAIN } } });
    nock.cleanAll();
    // Re-add the persistent discovery/JWKS interceptors `nock.cleanAll()`
    // just removed, so the next test can still reach them.
    nock(ISSUER)
      .persist()
      .get('/.well-known/openid-configuration')
      .reply(200, discoveryDocument(ISSUER));
    nock(ISSUER)
      .persist()
      .get('/jwks')
      .reply(200, { keys: [signingKey.jwk] });
  });

  /** Starts the login redirect and returns the raw oidc_txn cookie + the state/nonce embedded in the redirect URL. */
  async function startLogin(): Promise<{ txnCookie: string; state: string; nonce: string }> {
    const response = await request(app.getHttpServer())
      .get(`/api/auth/oidc/${PROVIDER_ID}/login`)
      .expect(302);

    const location = new URL(response.headers['location'] as string);
    const setCookie = response.headers['set-cookie'] as unknown as string[];
    const txnCookie = findSetCookie(setCookie, OIDC_TXN_COOKIE_NAME)!.split(';')[0];

    return {
      txnCookie,
      state: location.searchParams.get('state')!,
      nonce: location.searchParams.get('nonce')!,
    };
  }

  function mockTokenEndpoint(idToken: string): void {
    nock(ISSUER).post('/token').reply(200, {
      access_token: 'e2e-access-token',
      token_type: 'bearer',
      id_token: idToken,
      scope: 'openid profile email',
    });
  }

  function mockUserInfoEndpoint(claims: Record<string, unknown>): void {
    nock(ISSUER).get('/userinfo').reply(200, claims);
  }

  async function buildIdToken(subject: string, nonce: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return signIdToken(signingKey.privateKey, signingKey.jwk.kid, {
      iss: ISSUER,
      aud: CLIENT_ID,
      sub: subject,
      nonce,
      iat: now,
      exp: now + 300,
    });
  }

  describe('GET /api/auth/oidc/providers', () => {
    it('returns the configured providers without leaking clientId/clientSecret/issuer', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/oidc/providers')
        .expect(200);

      expect(response.body).toEqual({
        providers: [
          { id: 'fake-idp', displayName: 'Fake IdP' },
          { id: 'fake-idp-two', displayName: 'Fake IdP Two' },
        ],
      });

      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain('e2e-client-secret');
      expect(serialized).not.toContain(ISSUER);
    });
  });

  describe('GET /api/auth/oidc/:providerId/login', () => {
    it('404s for an unknown provider', async () => {
      await request(app.getHttpServer()).get('/api/auth/oidc/unknown-provider/login').expect(404);
    });
  });

  describe('GET /api/auth/oidc/:providerId/callback', () => {
    it('logs in a brand-new user: creates User + OidcIdentity and sets the standard auth cookies', async () => {
      const { txnCookie, state, nonce } = await startLogin();
      const subject = `subject-new-${Date.now()}`;
      const email = testEmail('new-user');
      mockTokenEndpoint(await buildIdToken(subject, nonce));
      mockUserInfoEndpoint({ sub: subject, email, email_verified: true });

      const response = await request(app.getHttpServer())
        .get(`/api/auth/oidc/${PROVIDER_ID}/callback`)
        .query({ code: 'fake-code', state })
        .set('Cookie', [txnCookie])
        .expect(302);

      expect(response.headers['location']).toBe('/');
      const setCookie = response.headers['set-cookie'] as unknown as string[];
      expect(findSetCookie(setCookie, 'access_token')).toMatch(/HttpOnly/i);
      expect(findSetCookie(setCookie, 'refresh_token')).toMatch(/HttpOnly/i);
      expect(findSetCookie(setCookie, CSRF_COOKIE_NAME)).toBeDefined();
      // Single-use: the oidc_txn cookie must be cleared on success too.
      expect(findSetCookie(setCookie, OIDC_TXN_COOKIE_NAME)).toMatch(/=;/);

      const createdUser = await prisma.user.findUnique({ where: { email } });
      expect(createdUser).not.toBeNull();
      expect(createdUser?.passwordHash).toBeNull();

      const identity = await prisma.oidcIdentity.findUnique({
        where: { providerId_subject: { providerId: PROVIDER_ID, subject } },
      });
      expect(identity?.userId).toBe(createdUser?.id);
    });

    it('resolves an already-linked OidcIdentity directly on a repeat login, without creating new rows', async () => {
      const email = testEmail('repeat-user');
      const subject = `subject-repeat-${Date.now()}`;
      const existingUser = await prisma.user.create({ data: { email, passwordHash: null } });
      await prisma.oidcIdentity.create({
        data: { userId: existingUser.id, providerId: PROVIDER_ID, subject },
      });

      const { txnCookie, state, nonce } = await startLogin();
      mockTokenEndpoint(await buildIdToken(subject, nonce));
      // No userinfo mock: a linked identity must short-circuit before ever
      // calling UserInfo, matching the unit-test-level assertion in
      // `oidc.service.spec.ts`. If the implementation regresses and calls
      // it anyway, this request has no interceptor and nock will reject it.

      const response = await request(app.getHttpServer())
        .get(`/api/auth/oidc/${PROVIDER_ID}/callback`)
        .query({ code: 'fake-code', state })
        .set('Cookie', [txnCookie])
        .expect(302);

      expect(response.headers['location']).toBe('/');

      const identityCount = await prisma.oidcIdentity.count({
        where: { userId: existingUser.id },
      });
      expect(identityCount).toBe(1);
      const userCount = await prisma.user.count({ where: { email } });
      expect(userCount).toBe(1);
    });

    it('auto-links to an existing local-auth user on email match, even with email_verified: false (ADR-0004, Call 3)', async () => {
      const email = testEmail('auto-link');
      const existingUser = await prisma.user.create({
        data: { email, passwordHash: 'irrelevant-local-hash' },
      });
      const subject = `subject-link-${Date.now()}`;

      const { txnCookie, state, nonce } = await startLogin();
      mockTokenEndpoint(await buildIdToken(subject, nonce));
      // Deliberately unverified — proves Call 3's unconditional linking.
      mockUserInfoEndpoint({ sub: subject, email, email_verified: false });

      const response = await request(app.getHttpServer())
        .get(`/api/auth/oidc/${PROVIDER_ID}/callback`)
        .query({ code: 'fake-code', state })
        .set('Cookie', [txnCookie])
        .expect(302);

      expect(response.headers['location']).toBe('/');

      const identity = await prisma.oidcIdentity.findUnique({
        where: { providerId_subject: { providerId: PROVIDER_ID, subject } },
      });
      expect(identity?.userId).toBe(existingUser.id);
      const userCount = await prisma.user.count({ where: { email } });
      expect(userCount).toBe(1);
    });

    it('redirects to /login?oidc_error=idp_error when the IdP returns ?error=access_denied', async () => {
      const { txnCookie, state } = await startLogin();

      const response = await request(app.getHttpServer())
        .get(`/api/auth/oidc/${PROVIDER_ID}/callback`)
        .query({ error: 'access_denied', error_description: 'user cancelled', state })
        .set('Cookie', [txnCookie])
        .expect(302);

      expect(response.headers['location']).toBe('/login?oidc_error=idp_error');
      const setCookie = response.headers['set-cookie'] as unknown as string[];
      expect(findSetCookie(setCookie, OIDC_TXN_COOKIE_NAME)).toMatch(/=;/);
    });

    it('redirects to /login?oidc_error=invalid_state when the oidc_txn cookie is missing', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/auth/oidc/${PROVIDER_ID}/callback`)
        .query({ code: 'fake-code', state: 'some-state' })
        .expect(302);

      expect(response.headers['location']).toBe('/login?oidc_error=invalid_state');
    });

    it('redirects to /login?oidc_error=invalid_state when the oidc_txn cookie is tampered with', async () => {
      const { txnCookie, state } = await startLogin();
      const tampered = `${OIDC_TXN_COOKIE_NAME}=${txnCookie.split('=')[1]}tampered`;

      const response = await request(app.getHttpServer())
        .get(`/api/auth/oidc/${PROVIDER_ID}/callback`)
        .query({ code: 'fake-code', state })
        .set('Cookie', [tampered])
        .expect(302);

      expect(response.headers['location']).toBe('/login?oidc_error=invalid_state');
    });

    it('404s for an unknown provider', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/oidc/unknown-provider/callback')
        .query({ code: 'fake-code', state: 'irrelevant' })
        .expect(404);
    });
  });
});
