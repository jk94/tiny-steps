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
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }
}
