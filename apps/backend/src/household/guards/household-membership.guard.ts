import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HouseholdAccessService } from '../household-access.service';
import { HouseholdRole, toHouseholdRole } from '../household-role.enum';
import type { HouseholdScopedRequest } from '../types/household-scoped-request';
import { HOUSEHOLD_ROLES_KEY } from './require-role.decorator';

/**
 * Enforces "a user may only access households they belong to" (see PRD
 * section 3), and optionally a required role via `@RequireRole(...)`.
 *
 * Must run AFTER `JwtAuthGuard` in the route's `@UseGuards(...)` array —
 * it reads `request.user.id`, which `JwtAuthGuard`/`JwtStrategy` populate.
 * NestJS runs guards in array order, so e.g.
 * `@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)` is required, not the
 * reverse.
 *
 * Reads `householdId` from the route param of the same name. On success,
 * attaches `request.membership` (with `household` included) so downstream
 * handlers can read it without a second query.
 */
@Injectable()
export class HouseholdMembershipGuard implements CanActivate {
  constructor(
    private readonly householdAccessService: HouseholdAccessService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HouseholdScopedRequest>();

    const userId = request.user.id;
    const householdId = request.params.householdId;

    const membership = await this.householdAccessService.findMembershipOrThrow(userId, householdId);

    const requiredRoles = this.reflector.getAllAndOverride<HouseholdRole[] | undefined>(
      HOUSEHOLD_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0) {
      const role = toHouseholdRole(membership.role);
      if (!requiredRoles.includes(role)) {
        throw new ForbiddenException();
      }
    }

    request.membership = membership;

    return true;
  }
}
