import type { Request } from 'express';

/**
 * The subset of `User` that's safe to expose on `request.user` and in API
 * responses — `passwordHash` is deliberately never included.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  createdAt: Date;
}

/**
 * Augments Express's `Request` with the `user` property that `JwtStrategy`
 * attaches (see `strategies/jwt.strategy.ts`). Only valid on routes guarded
 * by `JwtAuthGuard`.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
