import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HouseholdAccessService } from '../household-access.service';
import { HouseholdRole, toHouseholdRole } from '../household-role.enum';
import type { HouseholdScopedRequest } from '../types/household-scoped-request';
import { HOUSEHOLD_ROLES_KEY } from './require-role.decorator';

/** HTTP methods treated as state-changing by the default-deny rule below. */
const WRITE_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Enforces "a user may only access households they belong to" (see PRD
 * section 3), and the role requirement declared via `@RequireRole(...)`.
 *
 * Must run AFTER `JwtAuthGuard` in the route's `@UseGuards(...)` array —
 * it reads `request.user.id`, which `JwtAuthGuard`/`JwtStrategy` populate.
 * NestJS runs guards in array order, so e.g.
 * `@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)` is required, not the
 * reverse.
 *
 * Default-deny for writes (ROL-2): a state-changing request (POST/PUT/PATCH/
 * DELETE) on a route guarded here but carrying no `@RequireRole(...)` is
 * rejected at runtime rather than quietly allowed. Forgetting the annotation
 * on a new endpoint is thus a loud failure instead of an accidental
 * "every member may do this" — the fail-closed counterpart to the
 * `role-annotations.e2e-spec` static audit. Reads stay open to any member.
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
    // Express types `params` values as `string | string[]` (repeated query
    // params can produce arrays), but a `:householdId` path segment is
    // always a single string for the routes this guard is used on.
    const householdId = request.params.householdId as string;

    const membership = await this.householdAccessService.findMembershipOrThrow(userId, householdId);

    const requiredRoles = this.reflector.getAllAndOverride<HouseholdRole[] | undefined>(
      HOUSEHOLD_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const hasRoleRequirement = requiredRoles !== undefined && requiredRoles.length > 0;

    if (!hasRoleRequirement) {
      if (WRITE_METHODS.has(request.method)) {
        throw new ForbiddenException('write endpoint is missing an explicit role requirement');
      }
    } else {
      const role = toHouseholdRole(membership.role);
      if (!requiredRoles.includes(role)) {
        throw new ForbiddenException();
      }
    }

    request.membership = membership;

    return true;
  }
}
