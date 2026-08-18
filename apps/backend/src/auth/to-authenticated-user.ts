import type { User } from '@prisma/client';
import type { AuthenticatedUser } from './types/authenticated-request';

/**
 * The single projection from a persisted `User` row to the shape exposed on
 * `request.user` and in API responses. Shared by every producer
 * (`AuthService.issueSessionFor`/`updateName`, `AccessTokenVerifierService`)
 * so a newly exposed column can never end up on some responses but not
 * others — and so `passwordHash` can never leak from any of them.
 */
export function toAuthenticatedUser(user: User): AuthenticatedUser {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}
