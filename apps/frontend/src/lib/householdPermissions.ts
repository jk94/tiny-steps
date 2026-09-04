/**
 * Frontend mirror of `apps/backend/src/household/household-permissions.ts`
 * — deliberately duplicated rather than shared via a package (precedent:
 * `lib/milestoneCatalog.ts`). Keep in sync with the backend matrix by hand;
 * this file only drives UI gating for UX — the backend `@RequireRole` guard is
 * the actual authorization boundary, and a stale role in a second open tab is
 * still caught there.
 */

export type HouseholdRole = 'OWNER' | 'CO_PARENT' | 'CAREGIVER' | 'OBSERVER';

/** Every role. Anything a member may do at all (reading, own settings). */
export const ALL_ROLES: readonly HouseholdRole[] = ['OWNER', 'CO_PARENT', 'CAREGIVER', 'OBSERVER'];

/** May record entries and edit their OWN entries. */
export const ENTRY_WRITE_ROLES: readonly HouseholdRole[] = ['OWNER', 'CO_PARENT', 'CAREGIVER'];

/** May edit others' entries, delete entries and manage child profiles. */
export const FULL_WRITE_ROLES: readonly HouseholdRole[] = ['OWNER', 'CO_PARENT'];

/** May generate exports/reports. */
export const EXPORT_ROLES: readonly HouseholdRole[] = ['OWNER', 'CO_PARENT', 'CAREGIVER'];

/** May invite/remove members, change roles, rename/delete the household. */
export const OWNER_ROLES: readonly HouseholdRole[] = ['OWNER'];

/**
 * Roles an invite link may grant. `OWNER` is excluded on purpose: ownership is
 * transferred deliberately on an existing member, never by sharing a link.
 */
export const INVITABLE_ROLES: readonly HouseholdRole[] = ['CO_PARENT', 'CAREGIVER', 'OBSERVER'];

/**
 * Whether `role` is part of `bundle`. An undefined role (household not loaded
 * yet, or the query failed) is treated as "no permission", so a control is
 * hidden until the role is actually known rather than flashing into view.
 */
export function canWrite(
  role: HouseholdRole | undefined,
  bundle: readonly HouseholdRole[],
): boolean {
  return role !== undefined && bundle.includes(role);
}
