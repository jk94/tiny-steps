import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { toHouseholdRole } from '../household-role.enum';
import type { HouseholdRole } from '../household-role.enum';
import type { HouseholdScopedRequest } from '../types/household-scoped-request';

/**
 * Who is acting, and with which role, inside one household. Bundling the two
 * keeps service signatures to a single extra parameter and makes it obvious
 * that a role is only ever meaningful together with the user it belongs to.
 */
export interface HouseholdActor {
  userId: string;
  role: HouseholdRole;
}

/**
 * Injects the calling member as a `HouseholdActor`, for services that need to
 * decide more than a route-level role check can express — currently only
 * "may this member edit an entry someone else recorded?"
 * (`assertMayEditEntry`).
 *
 * Only valid on routes guarded by `JwtAuthGuard` + `HouseholdMembershipGuard`,
 * which populate `request.user` and `request.membership` respectively. Role
 * strings are read through `toHouseholdRole()` here so the rest of the app
 * never touches the untyped DB column (ROL-1). Not unit-tested on its own, per
 * NestJS's guidance on param decorators — covered by `roles.e2e-spec`.
 */
export const HouseholdActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): HouseholdActor => {
    const request = ctx.switchToHttp().getRequest<HouseholdScopedRequest>();
    return { userId: request.user.id, role: toHouseholdRole(request.membership.role) };
  },
);
