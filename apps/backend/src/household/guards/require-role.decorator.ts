import { SetMetadata } from '@nestjs/common';
import { HouseholdRole } from '../household-role.enum';

export const HOUSEHOLD_ROLES_KEY = 'householdRoles';

/**
 * Restricts a route to members holding one of the given `HouseholdRole`s.
 * Read by `HouseholdMembershipGuard` — has no effect unless that guard also
 * runs on the route. Omitting this decorator entirely allows any member of
 * the household through, regardless of role.
 */
export const RequireRole = (...roles: HouseholdRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(HOUSEHOLD_ROLES_KEY, roles);
