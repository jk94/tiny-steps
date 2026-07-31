import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSecrets } from '../../config/jwt.config';
import { JWT_SECRETS } from '../jwt-secrets.token';

/** Distinguishing claim so this token can never be confused with a real access token — see `JwtStrategy`. */
const OIDC_TXN_PURPOSE = 'oidc-txn';

/** Short-lived — the whole login-redirect round trip should complete in well under this. */
const OIDC_TXN_TTL = '10m';
export const OIDC_TXN_TTL_MS = 10 * 60 * 1000; // kept in sync with OIDC_TXN_TTL, used for cookie maxAge

/** Cookie name for the encoded transaction payload — see `OidcController`. */
export const OIDC_TXN_COOKIE_NAME = 'oidc_txn';

export interface OidcTransaction {
  providerId: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

interface OidcTransactionPayload extends OidcTransaction {
  purpose: typeof OIDC_TXN_PURPOSE;
}

/**
 * Encodes/decodes the short-lived `oidc_txn` cookie payload (`state`,
 * `nonce`, PKCE `code_verifier`, and the `providerId` the transaction was
 * started for) for the OIDC login/callback round trip.
 *
 * No server-side session store exists in this app (see ADR-0001), so this
 * reuses the existing `JwtService`/access-token secret (already wired in
 * `AuthModule`) rather than inventing a new signing mechanism — see
 * ADR-0004. The `purpose` claim keeps this structurally distinct from a
 * real access token; `JwtStrategy.validate()` explicitly rejects any
 * payload carrying it (see `strategies/jwt.strategy.ts`).
 */
@Injectable()
export class OidcTransactionCookieService {
  private readonly logger = new Logger(OidcTransactionCookieService.name);

  constructor(
    private readonly jwtService: JwtService,
    @Inject(JWT_SECRETS) private readonly jwtSecrets: JwtSecrets,
  ) {}

  async encode(txn: OidcTransaction): Promise<string> {
    const payload: OidcTransactionPayload = { ...txn, purpose: OIDC_TXN_PURPOSE };
    return this.jwtService.signAsync(payload, {
      secret: this.jwtSecrets.accessSecret,
      expiresIn: OIDC_TXN_TTL,
    });
  }

  /**
   * Returns `null` (never throws) on any verification failure — expired,
   * tampered, malformed, or not shaped like an `oidc_txn` token — so the
   * caller can uniformly map every such case to the `invalid_state` error
   * response.
   */
  async decode(token: string): Promise<OidcTransaction | null> {
    let payload: OidcTransactionPayload;
    try {
      payload = await this.jwtService.verifyAsync<OidcTransactionPayload>(token, {
        secret: this.jwtSecrets.accessSecret,
      });
    } catch (error) {
      this.logger.debug(`Rejected oidc_txn cookie: ${String(error)}`);
      return null;
    }

    if (
      payload.purpose !== OIDC_TXN_PURPOSE ||
      typeof payload.providerId !== 'string' ||
      typeof payload.state !== 'string' ||
      typeof payload.nonce !== 'string' ||
      typeof payload.codeVerifier !== 'string'
    ) {
      return null;
    }

    return {
      providerId: payload.providerId,
      state: payload.state,
      nonce: payload.nonce,
      codeVerifier: payload.codeVerifier,
    };
  }
}
