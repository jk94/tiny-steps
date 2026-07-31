import type { Household, Membership } from '@prisma/client';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

/** A `Membership` row with its `household` relation eagerly loaded. */
export type MembershipWithHousehold = Membership & { household: Household };

/**
 * Augments `AuthenticatedRequest` with the `membership` property that
 * `HouseholdMembershipGuard` attaches after resolving `request.user` against
 * `request.params.householdId`. Only valid on routes guarded by
 * `HouseholdMembershipGuard` (which itself must run after `JwtAuthGuard`).
 */
export interface HouseholdScopedRequest extends AuthenticatedRequest {
  membership: MembershipWithHousehold;
}
