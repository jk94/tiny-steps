import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClockService } from '../../common/clock.service';
import type { AlexaConfig } from '../../config/alexa.config';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessibleChild, AlexaChildDirectory } from '../alexa-child-directory.service';
import { AuthorizationRequestErrorCode, OAuthTokenError } from './alexa-oauth.errors';
import {
  generateAlexaToken,
  hashAlexaToken,
  PKCE_VERIFIER_PATTERN,
  pkceS256Challenge,
  secretsMatch,
} from './alexa-token.util';

/** One hour, the usual Alexa access-token lifetime; Alexa refreshes on its own. */
export const ALEXA_ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
/** RFC 6749 recommends a maximum of ten minutes; the round trip takes seconds. */
export const ALEXA_AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000;
/** `lastUsedAt` is informational — no need to write it on every single voice request. */
const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000;

/** The OAuth parameters of an authorization request, as the consent page relays them. */
export interface AuthorizationRequestParams {
  clientId: string;
  redirectUri: string;
  responseType: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export interface AlexaTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  /** Only on the initial code exchange — refresh tokens are not rotated (ADR-0017). */
  refresh_token?: string;
}

/** What a valid access token resolves to for the skill. */
export interface AlexaPrincipal {
  linkId: string;
  userId: string;
  defaultChildId: string | null;
}

export interface ConsentChildView {
  id: string;
  name: string;
  householdName: string;
}

/**
 * The minimal OAuth 2.0 authorization server behind Alexa account linking
 * (ADR-0017): one confidential client from `config.yml`, the authorization
 * code grant (optionally with PKCE), and a non-rotating refresh grant. Every
 * token is opaque and stored only as a SHA-256 hash.
 */
@Injectable()
export class AlexaOAuthService {
  private readonly logger = new Logger(AlexaOAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly childDirectory: AlexaChildDirectory,
    private readonly clock: ClockService,
  ) {}

  private get config(): AlexaConfig | undefined {
    return this.configService.get('alexa', { infer: true });
  }

  // ---------------------------------------------------------------------------
  // Authorization endpoint (consent page)
  // ---------------------------------------------------------------------------

  /**
   * Validates an authorization request without side effects and lists the
   * children the user may pick as default. Throws a `400` carrying a
   * machine-readable `code` the consent page maps to a message.
   */
  async describeAuthorizationRequest(
    userId: string,
    params: AuthorizationRequestParams,
  ): Promise<{ children: ConsentChildView[] }> {
    this.assertValidAuthorizationRequest(params);
    const children = await this.childDirectory.listAccessibleChildren(userId);
    return { children: children.map(toConsentChildView) };
  }

  /**
   * The user approved: issues a single-use code and returns the URL the
   * consent page sends the browser to — Alexa's redirect URI with `code` and
   * the untouched `state`.
   */
  async approve(
    userId: string,
    params: AuthorizationRequestParams,
    defaultChildId: string | null,
  ): Promise<{ redirectTo: string }> {
    this.assertValidAuthorizationRequest(params);

    if (defaultChildId !== null) {
      const child = await this.childDirectory.findAccessibleChild(userId, defaultChildId);
      if (!child) {
        throw authorizationError('CHILD_NOT_ACCESSIBLE');
      }
    }

    const now = this.clock.now();
    // Opportunistic cleanup instead of a cron job: codes are tiny and only
    // created when someone links an account.
    await this.prisma.alexaAuthorizationCode.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - ALEXA_AUTHORIZATION_CODE_TTL_MS) } },
    });

    const code = generateAlexaToken('code');
    await this.prisma.alexaAuthorizationCode.create({
      data: {
        codeHash: hashAlexaToken(code),
        userId,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge ?? null,
        codeChallengeMethod: params.codeChallenge ? 'S256' : null,
        defaultChildId,
        expiresAt: new Date(now.getTime() + ALEXA_AUTHORIZATION_CODE_TTL_MS),
      },
    });

    this.logger.log(`Issued an Alexa authorization code for user ${userId}`);
    return { redirectTo: buildRedirect(params.redirectUri, { code, state: params.state }) };
  }

  /** The user declined: RFC 6749 section 4.1.2.1 `access_denied`, with `state`. */
  deny(params: AuthorizationRequestParams): { redirectTo: string } {
    this.assertValidAuthorizationRequest(params);
    return {
      redirectTo: buildRedirect(params.redirectUri, {
        error: 'access_denied',
        state: params.state,
      }),
    };
  }

  private assertValidAuthorizationRequest(params: AuthorizationRequestParams): AlexaConfig {
    const config = this.config;
    if (!config) {
      throw new NotFoundException({ statusCode: 404, code: 'ALEXA_DISABLED' });
    }
    if (params.clientId !== config.clientId) {
      throw authorizationError('INVALID_CLIENT');
    }
    // Exact match only — no prefix or pattern matching (OAuth 2.0 Security BCP).
    if (!config.redirectUris.includes(params.redirectUri)) {
      throw authorizationError('INVALID_REDIRECT_URI');
    }
    if (params.responseType !== 'code') {
      throw authorizationError('UNSUPPORTED_RESPONSE_TYPE');
    }
    if (params.codeChallenge !== undefined) {
      // Only S256: `plain` would add nothing over a confidential client.
      const method = params.codeChallengeMethod ?? 'plain';
      if (method !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge)) {
        throw authorizationError('INVALID_PKCE');
      }
    } else if (params.codeChallengeMethod !== undefined) {
      throw authorizationError('INVALID_PKCE');
    }
    return config;
  }

  // ---------------------------------------------------------------------------
  // Token endpoint
  // ---------------------------------------------------------------------------

  /**
   * Client authentication (RFC 6749 section 2.3.1): HTTP Basic — Alexa's
   * default — or `client_id`/`client_secret` in the body, never both.
   */
  authenticateClient(
    authorizationHeader: string | undefined,
    bodyClientId: string | undefined,
    bodyClientSecret: string | undefined,
  ): void {
    const config = this.config;
    if (!config) {
      throw new OAuthTokenError('invalid_client');
    }

    let clientId: string | undefined;
    let clientSecret: string | undefined;

    if (authorizationHeader?.startsWith('Basic ')) {
      if (bodyClientSecret !== undefined) {
        throw new OAuthTokenError(
          'invalid_request',
          'Use exactly one client authentication method',
        );
      }
      const decoded = Buffer.from(authorizationHeader.slice('Basic '.length), 'base64').toString(
        'utf8',
      );
      const separator = decoded.indexOf(':');
      if (separator < 0) {
        throw new OAuthTokenError('invalid_client');
      }
      try {
        // Section 2.3.1: both parts are form-urlencoded before being joined.
        clientId = decodeURIComponent(decoded.slice(0, separator).replace(/\+/g, ' '));
        clientSecret = decodeURIComponent(decoded.slice(separator + 1).replace(/\+/g, ' '));
      } catch {
        throw new OAuthTokenError('invalid_client');
      }
      if (bodyClientId !== undefined && bodyClientId !== clientId) {
        throw new OAuthTokenError('invalid_client');
      }
    } else {
      clientId = bodyClientId;
      clientSecret = bodyClientSecret;
    }

    if (
      clientId === undefined ||
      clientSecret === undefined ||
      clientId !== config.clientId ||
      !secretsMatch(clientSecret, config.clientSecret)
    ) {
      throw new OAuthTokenError('invalid_client');
    }
  }

  async exchangeAuthorizationCode(input: {
    code: string | undefined;
    redirectUri: string | undefined;
    codeVerifier: string | undefined;
  }): Promise<AlexaTokenResponse> {
    if (!input.code || !input.redirectUri) {
      throw new OAuthTokenError('invalid_request', 'code and redirect_uri are required');
    }

    const now = this.clock.now();
    const record = await this.prisma.alexaAuthorizationCode.findUnique({
      where: { codeHash: hashAlexaToken(input.code) },
    });
    if (!record) {
      throw new OAuthTokenError('invalid_grant');
    }

    // Atomically claim the code, so two concurrent exchanges cannot both win.
    const claimed = await this.prisma.alexaAuthorizationCode.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (claimed.count === 0) {
      // Replay of an already-used code: whoever presents it might have stolen
      // it, so the link it produced is revoked (RFC 6749 section 4.1.2).
      const consumed = await this.prisma.alexaAuthorizationCode.findUnique({
        where: { id: record.id },
      });
      if (consumed?.linkId) {
        await this.revokeLink(consumed.linkId, now);
        this.logger.warn(`Alexa authorization code replayed; revoked link ${consumed.linkId}`);
      }
      throw new OAuthTokenError('invalid_grant');
    }

    if (record.expiresAt.getTime() < now.getTime()) {
      throw new OAuthTokenError('invalid_grant', 'Authorization code expired');
    }
    if (record.redirectUri !== input.redirectUri) {
      throw new OAuthTokenError('invalid_grant', 'redirect_uri mismatch');
    }
    if (record.codeChallenge) {
      if (!input.codeVerifier || !PKCE_VERIFIER_PATTERN.test(input.codeVerifier)) {
        throw new OAuthTokenError('invalid_grant', 'code_verifier missing or malformed');
      }
      if (pkceS256Challenge(input.codeVerifier) !== record.codeChallenge) {
        throw new OAuthTokenError('invalid_grant', 'code_verifier mismatch');
      }
    }

    // The default child was checked on the consent page; it may have been
    // deleted since, and the column is a real FK on the link.
    const defaultChildId =
      record.defaultChildId &&
      (await this.childDirectory.findAccessibleChild(record.userId, record.defaultChildId))
        ? record.defaultChildId
        : null;

    const refreshToken = generateAlexaToken('refresh');
    const accessToken = generateAlexaToken('access');
    const link = await this.prisma.alexaAccountLink.create({
      data: {
        userId: record.userId,
        refreshTokenHash: hashAlexaToken(refreshToken),
        defaultChildId,
        accessTokens: {
          create: {
            tokenHash: hashAlexaToken(accessToken),
            expiresAt: accessTokenExpiry(now),
          },
        },
      },
    });
    await this.prisma.alexaAuthorizationCode.update({
      where: { id: record.id },
      data: { linkId: link.id },
    });

    this.logger.log(`Linked an Alexa account for user ${record.userId} (link ${link.id})`);
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ALEXA_ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
    };
  }

  async refresh(refreshToken: string | undefined): Promise<AlexaTokenResponse> {
    if (!refreshToken) {
      throw new OAuthTokenError('invalid_request', 'refresh_token is required');
    }

    const link = await this.prisma.alexaAccountLink.findUnique({
      where: { refreshTokenHash: hashAlexaToken(refreshToken) },
    });
    if (!link || link.revokedAt) {
      throw new OAuthTokenError('invalid_grant');
    }

    const now = this.clock.now();
    const accessToken = generateAlexaToken('access');
    await this.prisma.$transaction([
      // Housekeeping: a link only ever needs its still-valid tokens.
      this.prisma.alexaAccessToken.deleteMany({
        where: { linkId: link.id, expiresAt: { lt: now } },
      }),
      this.prisma.alexaAccessToken.create({
        data: {
          linkId: link.id,
          tokenHash: hashAlexaToken(accessToken),
          expiresAt: accessTokenExpiry(now),
        },
      }),
    ]);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ALEXA_ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  // ---------------------------------------------------------------------------
  // Resource side (skill requests)
  // ---------------------------------------------------------------------------

  /**
   * Resolves a bearer token from a skill request to the linked user, or `null`
   * for anything unusable (unknown, expired, revoked) — the skill answers all
   * of those the same way: "please link your account" (ALX-11).
   */
  async resolveAccessToken(token: string | undefined): Promise<AlexaPrincipal | null> {
    if (!token || !this.config) {
      return null;
    }

    const record = await this.prisma.alexaAccessToken.findUnique({
      where: { tokenHash: hashAlexaToken(token) },
      include: { link: true },
    });
    const now = this.clock.now();
    if (!record || record.expiresAt.getTime() <= now.getTime() || record.link.revokedAt) {
      return null;
    }

    const { link } = record;
    if (
      !link.lastUsedAt ||
      now.getTime() - link.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS
    ) {
      await this.prisma.alexaAccountLink.update({
        where: { id: link.id },
        data: { lastUsedAt: now },
      });
    }

    return { linkId: link.id, userId: link.userId, defaultChildId: link.defaultChildId };
  }

  /** Revokes a link and drops its access tokens, effective immediately. */
  async revokeLink(linkId: string, now: Date = this.clock.now()): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.alexaAccountLink.updateMany({
        where: { id: linkId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.alexaAccessToken.deleteMany({ where: { linkId } }),
    ]);
  }
}

function accessTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + ALEXA_ACCESS_TOKEN_TTL_SECONDS * 1000);
}

function authorizationError(code: AuthorizationRequestErrorCode): BadRequestException {
  return new BadRequestException({ statusCode: 400, code });
}

function toConsentChildView(child: AccessibleChild): ConsentChildView {
  return { id: child.id, name: child.name, householdName: child.householdName };
}

/** Appends query parameters to a (configured, exact-matched) redirect URI. */
function buildRedirect(redirectUri: string, params: Record<string, string | undefined>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}
