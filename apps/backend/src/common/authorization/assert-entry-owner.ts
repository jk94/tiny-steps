import { ForbiddenException } from '@nestjs/common';
import type { HouseholdActor } from '../../household/decorators/household-actor.decorator';
import { ENTRY_WRITE_ROLES, FULL_WRITE_ROLES } from '../../household/household-permissions';
import { HouseholdRole } from '../../household/household-role.enum';

const hasRole = (roles: readonly HouseholdRole[], role: HouseholdRole): boolean =>
  roles.includes(role);

/** May this actor edit an entry, whoever recorded it? */
export function mayEditAnyEntry(actor: HouseholdActor): boolean {
  return hasRole(FULL_WRITE_ROLES, actor.role);
}

/**
 * May this actor record entries at all? True for OWNER/CO_PARENT/CAREGIVER,
 * false for OBSERVER. The route guard normally answers this already; the
 * predicate exists so a service can widen `assertMayEditEntry` for a specific
 * *recording*-flavoured mutation (see `HealthRecordService.update`'s mark-as-
 * done hand-off) without accidentally opening it to read-only members too.
 */
export function mayRecordEntries(actor: HouseholdActor): boolean {
  return hasRole(ENTRY_WRITE_ROLES, actor.role);
}

/**
 * Ownership check for editing an existing entry (event, growth measurement,
 * milestone, health record).
 *
 * Role alone cannot decide this: a role may be allowed to record entries and
 * edit its *own* without being allowed to touch anyone else's, so
 * `@RequireRole(...ENTRY_WRITE_ROLES)` on the route has to be paired with this
 * per-row check in the service, right after the existing row is loaded.
 *
 * Both branches are derived from the role bundles rather than naming CAREGIVER
 * directly, so a future fifth "may record and edit its own" role is covered by
 * adding it to `ENTRY_WRITE_ROLES` alone:
 * - a `FULL_WRITE_ROLES` member (OWNER/CO_PARENT) may edit any entry;
 * - any other `ENTRY_WRITE_ROLES` member (today: CAREGIVER) may edit only their
 *   own;
 * - anyone else never may. The route guard already rejects those roles; that
 *   branch is a defensive backstop for a service called from elsewhere.
 */
export function assertMayEditEntry(actor: HouseholdActor, entryOwnerUserId: string): void {
  if (mayEditAnyEntry(actor)) {
    return;
  }
  if (hasRole(ENTRY_WRITE_ROLES, actor.role) && actor.userId === entryOwnerUserId) {
    return;
  }
  throw new ForbiddenException({
    statusCode: 403,
    code: 'NOT_ENTRY_OWNER',
    message: 'This role may only edit its own entries',
  });
}
