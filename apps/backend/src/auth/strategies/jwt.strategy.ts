import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import type { JwtSecrets } from '../../config/jwt.config';
import { AccessTokenVerifierService } from '../access-token-verifier.service';
import { JWT_SECRETS } from '../jwt-secrets.token';
import type { AuthenticatedUser } from '../types/authenticated-request';

/** Reads the access token from the httpOnly `access_token` cookie, not an Authorization header. */
const cookieExtractor = (req: Request): string | null => {
  return req?.cookies?.['access_token'] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly accessTokenVerifier: AccessTokenVerifierService,
    @Inject(JWT_SECRETS) jwtSecrets: JwtSecrets,
  ) {
    super({
      jwtFromRequest: cookieExtractor,
      secretOrKey: jwtSecrets.accessSecret,
      ignoreExpiration: false,
      // Needed so `validate()` below can re-extract the raw token and
      // delegate to `AccessTokenVerifierService.verify()` — see its doc
      // comment for why the *same* verification logic must run here and in
      // `RealtimeGateway`'s WebSocket handshake auth.
      passReqToCallback: true,
    });
  }

  /**
   * Delegates entirely to `AccessTokenVerifierService.verify()` (payload
   * shape checks + fresh user lookup, see its own doc comment). Passport
   * has already verified this token's signature/expiration once via
   * `secretOrKey`/`ignoreExpiration` above, so `verify()` re-checking it
   * against the raw token is a harmless bit of duplicate crypto work — the
   * point of this delegation isn't to skip that, it's to guarantee this
   * path and the WebSocket handshake path can never diverge on the
   * payload/user-lookup rules.
   */
  async validate(req: Request): Promise<AuthenticatedUser> {
    const rawToken = cookieExtractor(req);
    if (!rawToken) {
      throw new UnauthorizedException('Invalid access token');
    }
    return this.accessTokenVerifier.verify(rawToken);
  }
}
