import { NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthCookieService } from '../auth-cookie.service';
import { AuthResult } from '../auth.service';
import {
  OIDC_TXN_COOKIE_NAME,
  OidcTransactionCookieService,
} from './oidc-transaction-cookie.service';
import { OidcProviderRegistry } from './oidc-provider-registry.service';
import { OidcController } from './oidc.controller';
import { OidcMappingError, OidcService } from './oidc.service';

// `oidc.controller.ts` transitively imports `oidc-provider-registry.service.ts`,
// which imports the real (ESM-only) `openid-client` package — not
// transformable by ts-jest in the plain `test` run (see the equivalent
// note in ADR-0003 for the `file-type` package). This spec never calls
// into `openid-client` directly (only through the fully-mocked services
// below), so an empty mock is enough to avoid the parse error.
jest.mock('openid-client', () => ({}));

const buildResponse = (): jest.Mocked<Pick<Response, 'cookie' | 'clearCookie' | 'redirect'>> => ({
  cookie: jest.fn().mockReturnThis(),
  clearCookie: jest.fn().mockReturnThis(),
  redirect: jest.fn(),
});

const buildRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    cookies: {},
    query: {},
    originalUrl: '/api/auth/oidc/keycloak/callback',
    ...overrides,
  }) as unknown as Request;

describe('OidcController', () => {
  let oidcService: jest.Mocked<Pick<OidcService, 'buildLoginRedirect' | 'handleCallback'>>;
  let registry: jest.Mocked<Pick<OidcProviderRegistry, 'get' | 'list'>>;
  let txnCookieService: jest.Mocked<Pick<OidcTransactionCookieService, 'encode' | 'decode'>>;
  let authCookieService: jest.Mocked<Pick<AuthCookieService, 'setAuthCookies'>>;
  let controller: OidcController;

  beforeEach(() => {
    oidcService = { buildLoginRedirect: jest.fn(), handleCallback: jest.fn() };
    registry = { get: jest.fn(), list: jest.fn() };
    txnCookieService = { encode: jest.fn(), decode: jest.fn() };
    authCookieService = { setAuthCookies: jest.fn() };
    controller = new OidcController(
      oidcService as unknown as OidcService,
      registry as unknown as OidcProviderRegistry,
      txnCookieService as unknown as OidcTransactionCookieService,
      authCookieService as unknown as AuthCookieService,
    );
  });

  describe('listProviders', () => {
    it('delegates to the registry', () => {
      registry.list.mockReturnValue([{ id: 'keycloak', displayName: 'Keycloak' }]);

      expect(controller.listProviders()).toEqual({
        providers: [{ id: 'keycloak', displayName: 'Keycloak' }],
      });
    });
  });

  describe('login', () => {
    it('404s for an unknown provider', async () => {
      oidcService.buildLoginRedirect.mockResolvedValue(undefined);

      await expect(
        controller.login('unknown', buildResponse() as unknown as Response),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sets the oidc_txn cookie and redirects to the authorization URL', async () => {
      oidcService.buildLoginRedirect.mockResolvedValue({
        authorizationUrl: 'https://idp.example.com/authorize?state=s',
        txn: { providerId: 'keycloak', state: 's', nonce: 'n', codeVerifier: 'c' },
      });
      txnCookieService.encode.mockResolvedValue('encoded-txn');
      const res = buildResponse();

      await controller.login('keycloak', res as unknown as Response);

      expect(txnCookieService.encode).toHaveBeenCalledWith({
        providerId: 'keycloak',
        state: 's',
        nonce: 'n',
        codeVerifier: 'c',
      });
      expect(res.cookie).toHaveBeenCalledWith(
        OIDC_TXN_COOKIE_NAME,
        'encoded-txn',
        expect.objectContaining({ httpOnly: true, path: '/api/auth/oidc' }),
      );
      expect(res.redirect).toHaveBeenCalledWith(302, 'https://idp.example.com/authorize?state=s');
    });
  });

  describe('callback', () => {
    it('404s for an unknown provider', async () => {
      registry.get.mockReturnValue(undefined);

      await expect(
        controller.callback('unknown', buildRequest(), buildResponse() as unknown as Response),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('clears the oidc_txn cookie and redirects with invalid_state when the cookie is missing', async () => {
      registry.get.mockReturnValue({} as never);
      const res = buildResponse();

      await controller.callback('keycloak', buildRequest(), res as unknown as Response);

      expect(res.clearCookie).toHaveBeenCalledWith(OIDC_TXN_COOKIE_NAME, expect.anything());
      expect(res.redirect).toHaveBeenCalledWith(302, '/login?oidc_error=invalid_state');
      expect(oidcService.handleCallback).not.toHaveBeenCalled();
    });

    it('clears the cookie and redirects with invalid_state when decode() returns null', async () => {
      registry.get.mockReturnValue({} as never);
      txnCookieService.decode.mockResolvedValue(null);
      const res = buildResponse();

      await controller.callback(
        'keycloak',
        buildRequest({ cookies: { [OIDC_TXN_COOKIE_NAME]: 'garbage' } }),
        res as unknown as Response,
      );

      expect(res.clearCookie).toHaveBeenCalledWith(OIDC_TXN_COOKIE_NAME, expect.anything());
      expect(res.redirect).toHaveBeenCalledWith(302, '/login?oidc_error=invalid_state');
    });

    it('redirects with invalid_state when the decoded providerId does not match the route param', async () => {
      registry.get.mockReturnValue({} as never);
      txnCookieService.decode.mockResolvedValue({
        providerId: 'other-provider',
        state: 's',
        nonce: 'n',
        codeVerifier: 'c',
      });
      const res = buildResponse();

      await controller.callback(
        'keycloak',
        buildRequest({ cookies: { [OIDC_TXN_COOKIE_NAME]: 'encoded' } }),
        res as unknown as Response,
      );

      expect(res.redirect).toHaveBeenCalledWith(302, '/login?oidc_error=invalid_state');
      expect(oidcService.handleCallback).not.toHaveBeenCalled();
    });

    it('redirects with idp_error and does not attempt the grant when the IdP returned ?error=', async () => {
      registry.get.mockReturnValue({} as never);
      txnCookieService.decode.mockResolvedValue({
        providerId: 'keycloak',
        state: 's',
        nonce: 'n',
        codeVerifier: 'c',
      });
      const res = buildResponse();

      await controller.callback(
        'keycloak',
        buildRequest({
          cookies: { [OIDC_TXN_COOKIE_NAME]: 'encoded' },
          query: { error: 'access_denied' },
        }),
        res as unknown as Response,
      );

      expect(res.redirect).toHaveBeenCalledWith(302, '/login?oidc_error=idp_error');
      expect(oidcService.handleCallback).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith(OIDC_TXN_COOKIE_NAME, expect.anything());
    });

    it('redirects with the mapped error code when handleCallback throws an OidcMappingError', async () => {
      registry.get.mockReturnValue({} as never);
      txnCookieService.decode.mockResolvedValue({
        providerId: 'keycloak',
        state: 's',
        nonce: 'n',
        codeVerifier: 'c',
      });
      oidcService.handleCallback.mockRejectedValue(
        new OidcMappingError('email_required', 'no email claim'),
      );
      const res = buildResponse();

      await controller.callback(
        'keycloak',
        buildRequest({ cookies: { [OIDC_TXN_COOKIE_NAME]: 'encoded' } }),
        res as unknown as Response,
      );

      expect(res.redirect).toHaveBeenCalledWith(302, '/login?oidc_error=email_required');
    });

    it('redirects with auth_failed on any other error thrown by handleCallback', async () => {
      registry.get.mockReturnValue({} as never);
      txnCookieService.decode.mockResolvedValue({
        providerId: 'keycloak',
        state: 's',
        nonce: 'n',
        codeVerifier: 'c',
      });
      oidcService.handleCallback.mockRejectedValue(new Error('state mismatch'));
      const res = buildResponse();

      await controller.callback(
        'keycloak',
        buildRequest({ cookies: { [OIDC_TXN_COOKIE_NAME]: 'encoded' } }),
        res as unknown as Response,
      );

      expect(res.redirect).toHaveBeenCalledWith(302, '/login?oidc_error=auth_failed');
    });

    it('sets auth cookies and redirects to / on success', async () => {
      registry.get.mockReturnValue({} as never);
      txnCookieService.decode.mockResolvedValue({
        providerId: 'keycloak',
        state: 's',
        nonce: 'n',
        codeVerifier: 'c',
      });
      const authResult: AuthResult = {
        user: { id: 'user-1', email: 'parent@example.com', createdAt: new Date() },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      };
      oidcService.handleCallback.mockResolvedValue(authResult);
      const res = buildResponse();

      await controller.callback(
        'keycloak',
        buildRequest({ cookies: { [OIDC_TXN_COOKIE_NAME]: 'encoded' } }),
        res as unknown as Response,
      );

      expect(authCookieService.setAuthCookies).toHaveBeenCalledWith(res, authResult.tokens);
      expect(res.redirect).toHaveBeenCalledWith(302, '/');
      expect(res.clearCookie).toHaveBeenCalledWith(OIDC_TXN_COOKIE_NAME, expect.anything());
    });
  });
});
