import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS } from '../config/jwt.config';
import { TokenPair } from './auth.service';
import { CSRF_COOKIE_NAME } from './guards/csrf.guard';

export const ACCESS_TOKEN_COOKIE_NAME = 'access_token';
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

/**
 * `secure` is env-conditional: local dev runs over plain HTTP, but any
 * non-development deployment (see README/docker-compose) should always be
 * behind HTTPS, so cookies must require it there.
 */
const isProduction = () => process.env.NODE_ENV === 'production';

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax', // not 'strict' — would break the OIDC redirect-callback flow
  secure: isProduction(),
};

const accessTokenCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  path: '/api',
  maxAge: ACCESS_TOKEN_TTL_MS,
};

// Scoped tighter than the access-token cookie: only sent to the auth routes
// that actually need it (refresh/logout), reducing exposure.
const refreshTokenCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  path: '/api/auth',
  maxAge: REFRESH_TOKEN_TTL_MS,
};

// Non-httpOnly by design — the double-submit CSRF check requires
// client-side JS to be able to read this value and echo it back in the
// `X-CSRF-Token` header (see `CsrfGuard`).
const csrfCookieOptions: CookieOptions = {
  httpOnly: false,
  sameSite: 'lax',
  secure: isProduction(),
  path: '/api',
  maxAge: REFRESH_TOKEN_TTL_MS,
};

/**
 * Sets/clears the three auth cookies (`access_token`, `refresh_token`,
 * `csrf_token`) with the exact same options for every entry point that
 * establishes or tears down a session — `AuthController` (local
 * register/login/refresh/logout) and `OidcController` (OIDC callback), so
 * an OIDC-originated session is indistinguishable from a local one to
 * `JwtAuthGuard`/`@CurrentUser()` downstream.
 */
@Injectable()
export class AuthCookieService {
  setAuthCookies(res: Response, tokens: TokenPair): void {
    const csrfToken = randomBytes(32).toString('hex');
    this.setTokenCookies(res, tokens);
    res.cookie(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions);
  }

  setTokenCookies(res: Response, tokens: TokenPair): void {
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, tokens.accessToken, accessTokenCookieOptions);
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, refreshTokenCookieOptions);
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, accessTokenCookieOptions);
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, refreshTokenCookieOptions);
    res.clearCookie(CSRF_COOKIE_NAME, csrfCookieOptions);
  }
}
