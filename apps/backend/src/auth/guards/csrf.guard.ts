import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Double-submit CSRF check for authenticated, state-changing routes
 * (`refresh`, `logout`). Not applied to `register`/`login`, which are
 * pre-session and already covered by `SameSite=Lax` + no CORS (see
 * `main.ts`). Requires the `X-CSRF-Token` header to match the non-httpOnly
 * `csrf_token` cookie set on successful login/register — a same-origin
 * script can read the cookie and echo it back, but a cross-site form/fetch
 * cannot (no CORS, so it can't read response headers/cookies either way,
 * and can't set a custom header without triggering a CORS preflight that
 * this API doesn't answer).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = request.headers[CSRF_HEADER_NAME];

    if (
      typeof cookieToken !== 'string' ||
      typeof headerToken !== 'string' ||
      cookieToken.length === 0 ||
      cookieToken !== headerToken
    ) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    return true;
  }
}
