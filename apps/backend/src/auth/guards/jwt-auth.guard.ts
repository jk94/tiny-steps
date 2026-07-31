import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects routes requiring a valid access token (see `JwtStrategy`).
 * Applied to `/api/auth/me`, `/api/auth/logout`, and any future
 * authenticated route — deliberately NOT applied to `register`/`login`
 * (pre-session) or `refresh` (reads the refresh cookie, not the access one).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
