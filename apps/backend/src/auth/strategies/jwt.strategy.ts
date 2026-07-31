import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import type { JwtSecrets } from '../../config/jwt.config';
import { PrismaService } from '../../prisma/prisma.service';
import { JWT_SECRETS } from '../jwt-secrets.token';
import type { AuthenticatedUser } from '../types/authenticated-request';

interface AccessTokenPayload {
  sub: string;
  /**
   * Real access tokens never set this claim. Only present to let
   * `validate()` structurally reject an `oidc_txn` transaction token
   * (see `auth/oidc/oidc-transaction-cookie.service.ts`) if one were ever
   * presented here — e.g. an attacker copying its value into the
   * `access_token` cookie by hand. Both token kinds are signed with the
   * same secret (see ADR-0004), so signature verification alone can't
   * distinguish them; this claim-shape check is the structural guard.
   */
  purpose?: unknown;
}

/** Reads the access token from the httpOnly `access_token` cookie, not an Authorization header. */
const cookieExtractor = (req: Request): string | null => {
  return req?.cookies?.['access_token'] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(JWT_SECRETS) jwtSecrets: JwtSecrets,
  ) {
    super({
      jwtFromRequest: cookieExtractor,
      secretOrKey: jwtSecrets.accessSecret,
      ignoreExpiration: false,
    });
  }

  /**
   * Looks the user up fresh on every request (rather than trusting the JWT
   * payload alone) so a deleted/disabled user is rejected even while their
   * access token is still cryptographically valid.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    // See the `purpose` field's doc comment above — structurally reject
    // anything shaped like an `oidc_txn` transaction token rather than a
    // real access token.
    if (payload.purpose !== undefined || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }
}
