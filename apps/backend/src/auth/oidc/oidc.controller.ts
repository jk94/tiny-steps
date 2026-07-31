import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { resolvePublicUrl } from '../../config/public-url';
import { AuthCookieService } from '../auth-cookie.service';
import {
  OIDC_TXN_COOKIE_NAME,
  OIDC_TXN_TTL_MS,
  OidcTransactionCookieService,
} from './oidc-transaction-cookie.service';
import { OidcProviderRegistry, PublicOidcProvider } from './oidc-provider-registry.service';
import { OidcMappingError, OidcService } from './oidc.service';

/** Every failure mode the frontend's (not-yet-built) `/login` page can distinguish via `?oidc_error=`. */
type OidcErrorCode =
  'invalid_state' | 'idp_error' | 'auth_failed' | 'email_required' | 'email_in_use';

const isProduction = () => process.env.NODE_ENV === 'production';

// Scoped to /api/auth/oidc only — this cookie has no purpose outside the
// login/callback round trip it's created for.
const oidcTxnCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction(),
  path: '/api/auth/oidc',
  maxAge: OIDC_TXN_TTL_MS,
};

@Controller('auth/oidc')
export class OidcController {
  private readonly logger = new Logger(OidcController.name);

  constructor(
    private readonly oidcService: OidcService,
    private readonly registry: OidcProviderRegistry,
    private readonly txnCookieService: OidcTransactionCookieService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  /** Public, unauthenticated — lets the (future) frontend render one login button per configured provider. */
  @Get('providers')
  listProviders(): { providers: PublicOidcProvider[] } {
    return { providers: this.registry.list() };
  }

  @Get(':providerId/login')
  async login(@Param('providerId') providerId: string, @Res() res: Response): Promise<void> {
    const result = await this.oidcService.buildLoginRedirect(providerId);
    if (!result) {
      // Unknown provider — 404, consistent with this app's existing
      // not-403 precedent for hiding unnecessary detail.
      throw new NotFoundException();
    }

    const txnCookieValue = await this.txnCookieService.encode(result.txn);
    res.cookie(OIDC_TXN_COOKIE_NAME, txnCookieValue, oidcTxnCookieOptions);
    res.redirect(HttpStatus.FOUND, result.authorizationUrl);
  }

  @Get(':providerId/callback')
  async callback(
    @Param('providerId') providerId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.registry.get(providerId)) {
      throw new NotFoundException();
    }

    const rawTxnCookie: unknown = req.cookies?.[OIDC_TXN_COOKIE_NAME];
    // Single-use: clear immediately regardless of outcome, on every exit
    // path from here on (success and every error branch below).
    res.clearCookie(OIDC_TXN_COOKIE_NAME, oidcTxnCookieOptions);

    if (typeof rawTxnCookie !== 'string') {
      return this.redirectWithError(res, 'invalid_state');
    }

    const txn = await this.txnCookieService.decode(rawTxnCookie);
    if (!txn || txn.providerId !== providerId) {
      return this.redirectWithError(res, 'invalid_state');
    }

    const idpError = req.query['error'];
    if (typeof idpError === 'string') {
      // Logged server-side only — don't leak IdP-specific detail into the
      // redirect URL the browser ends up at.
      this.logger.warn(
        `IdP returned an error on the OIDC callback for provider "${providerId}": ${idpError}` +
          (typeof req.query['error_description'] === 'string'
            ? ` — ${req.query['error_description']}`
            : ''),
      );
      return this.redirectWithError(res, 'idp_error');
    }

    const currentUrl = new URL(req.originalUrl, resolvePublicUrl());

    try {
      const result = await this.oidcService.handleCallback(providerId, currentUrl, txn);
      if (!result) {
        // Defensive: the registry lookup above succeeded, so this
        // shouldn't happen in practice.
        return this.redirectWithError(res, 'auth_failed');
      }

      this.authCookieService.setAuthCookies(res, result.tokens);
      res.redirect(HttpStatus.FOUND, '/');
    } catch (error) {
      if (error instanceof OidcMappingError) {
        return this.redirectWithError(res, error.code);
      }

      // state/nonce/PKCE/token-exchange failures thrown by
      // `authorizationCodeGrant` land here — logged server-side only, see
      // the error matrix in ADR-0004.
      this.logger.error(`OIDC callback failed for provider "${providerId}": ${String(error)}`);
      return this.redirectWithError(res, 'auth_failed');
    }
  }

  private redirectWithError(res: Response, code: OidcErrorCode): void {
    res.redirect(HttpStatus.FOUND, `/login?oidc_error=${code}`);
  }
}
