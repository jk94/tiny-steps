import type { Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  AuthCookieService,
  REFRESH_TOKEN_COOKIE_NAME,
} from './auth-cookie.service';
import { CSRF_COOKIE_NAME } from './guards/csrf.guard';

describe('AuthCookieService', () => {
  let service: AuthCookieService;
  let res: jest.Mocked<Pick<Response, 'cookie' | 'clearCookie'>>;

  beforeEach(() => {
    service = new AuthCookieService();
    res = {
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };
  });

  it('sets access/refresh/csrf cookies with the documented scoping', () => {
    service.setAuthCookies(res as unknown as Response, {
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
    });

    expect(res.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE_NAME,
      'access-token-value',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/api' }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE_NAME,
      'refresh-token-value',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/api/auth' }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: false, sameSite: 'lax', path: '/' }),
    );
  });

  it('generates a fresh, non-empty CSRF token on every call', () => {
    service.setAuthCookies(res as unknown as Response, {
      accessToken: 'a',
      refreshToken: 'b',
    });
    const firstCsrfCall = res.cookie.mock.calls.find((call) => call[0] === CSRF_COOKIE_NAME);

    service.setAuthCookies(res as unknown as Response, {
      accessToken: 'a2',
      refreshToken: 'b2',
    });
    const secondCsrfCall = res.cookie.mock.calls
      .reverse()
      .find((call) => call[0] === CSRF_COOKIE_NAME);

    expect(firstCsrfCall?.[1]).not.toBe(secondCsrfCall?.[1]);
  });

  it('clears all three cookies with matching options', () => {
    service.clearAuthCookies(res as unknown as Response);

    expect(res.clearCookie).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE_NAME, expect.anything());
    expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, expect.anything());
    expect(res.clearCookie).toHaveBeenCalledWith(CSRF_COOKIE_NAME, expect.anything());
  });
});
