import { Injectable, Logger } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as client from 'openid-client';
import { resolvePublicUrl } from '../../config/public-url';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthResult, AuthService } from '../auth.service';
import { OidcProviderEntry, OidcProviderRegistry } from './oidc-provider-registry.service';
import { OidcTransaction } from './oidc-transaction-cookie.service';

/** Prisma's unique-constraint-violation error code (see docs.prisma.io). */
const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export type OidcMappingErrorCode = 'email_required' | 'email_in_use';

/**
 * Thrown for the account-mapping failure modes that `OidcController` maps
 * to a specific `?oidc_error=<code>` redirect (see the error matrix in
 * ADR-0004). Any other error thrown out of this service (e.g. from
 * `authorizationCodeGrant`'s own state/PKCE/nonce/token-exchange
 * validation) is treated generically by the controller as `auth_failed`.
 */
export class OidcMappingError extends Error {
  constructor(
    readonly code: OidcMappingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OidcMappingError';
  }
}

function buildRedirectUri(providerId: string): string {
  return `${resolvePublicUrl()}/api/auth/oidc/${providerId}/callback`;
}

/**
 * Drives the OIDC Authorization Code Flow + PKCE via `openid-client`
 * directly (no Passport strategy — see ADR-0004) and implements the
 * account-mapping policy from ADR-0004 (unconditional email-match
 * auto-linking — a deliberate, user-approved risk acceptance, NOT an
 * oversight; do not add an `email_verified` gate here without revisiting
 * that decision).
 */
@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);

  constructor(
    private readonly registry: OidcProviderRegistry,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Returns `undefined` when `providerId` isn't configured — the caller
   * (`OidcController`) maps that to a `404`.
   */
  async buildLoginRedirect(
    providerId: string,
  ): Promise<{ authorizationUrl: string; txn: OidcTransaction } | undefined> {
    const entry = this.registry.get(providerId);
    if (!entry) {
      return undefined;
    }

    const state = client.randomState();
    const nonce = client.randomNonce();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

    const authorizationUrl = client.buildAuthorizationUrl(entry.oidcConfig, {
      redirect_uri: buildRedirectUri(providerId),
      scope: entry.config.scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      nonce,
    });

    return {
      authorizationUrl: authorizationUrl.toString(),
      txn: { providerId, state, nonce, codeVerifier },
    };
  }

  /**
   * Completes the Authorization Code Grant, resolves/creates the local
   * `User`, and establishes a session for it via
   * `AuthService.issueSessionFor()` — returning the same `AuthResult` a
   * local login would, so `OidcController` can set the identical three
   * auth cookies via `AuthCookieService`.
   *
   * Returns `undefined` when `providerId` isn't configured (defensive —
   * `OidcController` already checked this before decoding the `oidc_txn`
   * cookie, so this should be unreachable in practice).
   *
   * Lets `authorizationCodeGrant`'s own internal validation (state, PKCE,
   * nonce, issuer, audience, signature, expiry — see openid-client docs)
   * do its job; any failure it throws propagates to the caller, which
   * maps it to the generic `auth_failed` error.
   */
  async handleCallback(
    providerId: string,
    currentUrl: URL,
    txn: Pick<OidcTransaction, 'state' | 'nonce' | 'codeVerifier'>,
  ): Promise<AuthResult | undefined> {
    const entry = this.registry.get(providerId);
    if (!entry) {
      return undefined;
    }

    const tokens = await client.authorizationCodeGrant(entry.oidcConfig, currentUrl, {
      expectedState: txn.state,
      expectedNonce: txn.nonce,
      pkceCodeVerifier: txn.codeVerifier,
    });

    // Guaranteed present: an ID token is always returned when `expectedNonce`
    // is passed above (openid-client asserts this), and `sub` is a required
    // ID Token claim per the OIDC spec.
    const subject = tokens.claims()!.sub;

    const user = await this.resolveUser(entry.config.id, subject, tokens.access_token, entry);

    return this.authService.issueSessionFor(user);
  }

  private async resolveUser(
    providerId: string,
    subject: string,
    accessToken: string,
    entry: OidcProviderEntry,
  ): Promise<User> {
    // Short-circuit on an already-linked identity: no email lookup at all,
    // matching a returning OIDC user straight to their local account.
    const existingIdentity = await this.prisma.oidcIdentity.findUnique({
      where: { providerId_subject: { providerId, subject } },
    });

    if (existingIdentity) {
      const user = await this.prisma.user.findUnique({ where: { id: existingIdentity.userId } });
      if (!user) {
        // Shouldn't happen (User<-OidcIdentity FK is ON DELETE RESTRICT),
        // but fail loudly rather than silently creating a duplicate.
        throw new Error(
          `OidcIdentity ${existingIdentity.id} references missing User ${existingIdentity.userId}`,
        );
      }
      return user;
    }

    // No existing identity — need the email claim to map to a local
    // account. Not every IdP includes `email` in the ID Token depending on
    // granted scopes/configuration, so fetch UserInfo for the authoritative
    // claim set (`fetchUserInfo` also re-validates `sub` matches).
    const userInfo = await client.fetchUserInfo(entry.oidcConfig, accessToken, subject);
    const rawEmail = userInfo.email;
    if (typeof rawEmail !== 'string' || rawEmail.trim().length === 0) {
      throw new OidcMappingError(
        'email_required',
        `OIDC provider "${providerId}" did not return an email claim for subject "${subject}"`,
      );
    }
    // Same normalization as local register/login (see
    // `dto/normalize-email.transform.ts`) so an OIDC login matches an
    // existing local account regardless of casing/whitespace.
    const email = rawEmail.trim().toLowerCase();

    const existingUserByEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingUserByEmail) {
      // ADR-0004, Call 3: unconditional auto-link on email match. No
      // `email_verified` inspection of any kind — this is a deliberate,
      // user-approved risk acceptance, not an oversight. Do not add a
      // verification gate here without revisiting that decision.
      await this.prisma.oidcIdentity.create({
        data: { userId: existingUserByEmail.id, providerId, subject },
      });
      return existingUserByEmail;
    }

    return this.createUserWithIdentity(email, providerId, subject);
  }

  private async createUserWithIdentity(
    email: string,
    providerId: string,
    subject: string,
  ): Promise<User> {
    let newUser: User;
    try {
      newUser = await this.prisma.user.create({ data: { email, passwordHash: null } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        // Concurrency safety net only (see ADR-0004) — two simultaneous
        // OIDC callbacks resolving the same brand-new email at the same
        // instant. Not a policy gate: once any User with this email exists,
        // the auto-link branch above handles it.
        throw new OidcMappingError(
          'email_in_use',
          `Concurrent registration race for email on provider "${providerId}"`,
        );
      }
      throw error;
    }

    try {
      await this.prisma.oidcIdentity.create({ data: { userId: newUser.id, providerId, subject } });
    } catch (error) {
      // The User row now exists without a linked OidcIdentity — an orphan
      // in the same spirit as ADR-0003's accepted orphaned-file tradeoff:
      // logged for operator visibility, not automatically swept.
      this.logger.error(
        `Created User ${newUser.id} for OIDC login but failed to create its OidcIdentity row: ${String(error)}`,
      );
      throw error;
    }

    return newUser;
  }
}
