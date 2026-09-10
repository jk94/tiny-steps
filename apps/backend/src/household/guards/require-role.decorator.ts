import { SetMetadata } from '@nestjs/common';
import { HouseholdRole } from '../household-role.enum';

export const HOUSEHOLD_ROLES_KEY = 'householdRoles';

/**
 * Restricts a route to members holding one of the given `HouseholdRole`s.
 * Read by `HouseholdMembershipGuard` — has no effect unless that guard also
 * runs on the route.
 *
 * Prefer the named bundles from `../household-permissions` (e.g.
 * `@RequireRole(...ENTRY_WRITE_ROLES)`) over inline role lists, so the intent
 * is stated once and a future role change lands in a single file.
 *
 * Omitting this decorator leaves a *read* route open to any household member.
 * On a state-changing route (POST/PUT/PATCH/DELETE) omitting it is an error:
 * the guard rejects such requests with 403 rather than defaulting to "any
 * member may write" (ROL-2).
 */
export const RequireRole = (...roles: HouseholdRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(HOUSEHOLD_ROLES_KEY, roles);
