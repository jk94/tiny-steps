import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSecrets } from '../config/jwt.config';
import { PrismaService } from '../prisma/prisma.service';
import { JWT_SECRETS } from './jwt-secrets.token';
import { toAuthenticatedUser } from './to-authenticated-user';
import type { AuthenticatedUser } from './types/authenticated-request';

interface AccessTokenPayload {
  sub: string;
  /**
   * Real access tokens never set this claim. Only present to let `verify()`
   * structurally reject an `oidc_txn` transaction token (see
   * `auth/oidc/oidc-transaction-cookie.service.ts`) if one were ever
   * presented here — e.g. an attacker copying its value into the
   * `access_token` cookie by hand. Both token kinds are signed with the
   * same secret (see ADR-0004), so signature verification alone can't
   * distinguish them; this claim-shape check is the structural guard.
   */
  purpose?: unknown;
}

/**
 * Verifies a raw access token end-to-end (signature/expiration, payload
 * shape, and a fresh user lookup) and resolves the `AuthenticatedUser` it
 * belongs to, or rejects with `UnauthorizedException`.
 *
 * Extracted out of `JwtStrategy.validate()` so the exact same logic can be
 * reused by `RealtimeGateway`'s WebSocket handshake auth (see
 * `realtime/realtime.gateway.ts`), which has no Passport strategy running
 * and therefore no other way to verify the `access_token` cookie. Keeping a
 * single implementation is what prevents the HTTP and WebSocket auth paths
 * from silently diverging over time.
 */
@Injectable()
export class AccessTokenVerifierService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(JWT_SECRETS) private readonly jwtSecrets: JwtSecrets,
  ) {}

  async verify(rawToken: string): Promise<AuthenticatedUser> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(rawToken, {
        secret: this.jwtSecrets.accessSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    // See the `purpose` field's doc comment above — structurally reject
    // anything shaped like an `oidc_txn` transaction token rather than a
    // real access token.
    if (payload.purpose !== undefined || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Invalid access token');
    }

    // Looks the user up fresh on every call (rather than trusting the JWT
    // payload alone) so a deleted/disabled user is rejected even while
    // their access token is still cryptographically valid.
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return toAuthenticatedUser(user);
  }
}
