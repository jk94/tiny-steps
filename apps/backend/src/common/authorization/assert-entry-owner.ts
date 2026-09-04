import { ForbiddenException } from '@nestjs/common';
import type { HouseholdActor } from '../../household/decorators/household-actor.decorator';
import { FULL_WRITE_ROLES } from '../../household/household-permissions';
import { HouseholdRole } from '../../household/household-role.enum';

/**
 * Ownership check for editing an existing entry (event, growth measurement,
 * milestone, health record).
 *
 * Role alone cannot decide this: a CAREGIVER may edit entries — but only the
 * ones they recorded themselves — so `@RequireRole(...ENTRY_WRITE_ROLES)` on
 * the route has to be paired with this per-row check in the service, right
 * after the existing row is loaded.
 *
 * - OWNER/CO_PARENT may edit any entry.
 * - CAREGIVER may edit only their own.
 * - Anyone else never may. The route guard already rejects those roles; this
 *   branch is a defensive backstop for a service called from elsewhere.
 */
export function assertMayEditEntry(actor: HouseholdActor, entryOwnerUserId: string): void {
  if ((FULL_WRITE_ROLES as readonly HouseholdRole[]).includes(actor.role)) {
    return;
  }
  if (actor.role === HouseholdRole.CAREGIVER && actor.userId === entryOwnerUserId) {
    return;
  }
  throw new ForbiddenException({
    statusCode: 403,
    code: 'NOT_ENTRY_OWNER',
    message: 'This role may only edit its own entries',
  });
}
