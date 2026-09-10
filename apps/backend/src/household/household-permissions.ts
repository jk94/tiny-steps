import { HouseholdRole } from './household-role.enum';

/**
 * Named role bundles for `@RequireRole(...)`, so routes express *what kind of
 * permission* they need instead of repeating role lists. Adding a fifth role
 * later means editing this file, not hunting through every controller.
 *
 * The authoritative, human-readable version of the same rules is
 * `HOUSEHOLD_PERMISSION_MATRIX` at the bottom of this file — the bundles are
 * derived from it conceptually, and `household-permissions.spec.ts` asserts
 * the two never drift apart.
 */

/** Every role. Used for routes any member may call, that still need an
 * explicit annotation because they write (e.g. own notification settings). */
export const ALL_ROLES = [
  HouseholdRole.OWNER,
  HouseholdRole.CO_PARENT,
  HouseholdRole.CAREGIVER,
  HouseholdRole.OBSERVER,
] as const;

/** May record events/growth/milestones/medical entries and edit their OWN
 * entries. Ownership itself is not a role question and is enforced separately
 * by `assertMayEditEntry()`. */
export const ENTRY_WRITE_ROLES = [
  HouseholdRole.OWNER,
  HouseholdRole.CO_PARENT,
  HouseholdRole.CAREGIVER,
] as const;

/** May edit others' entries, delete entries and manage child profiles. */
export const FULL_WRITE_ROLES = [HouseholdRole.OWNER, HouseholdRole.CO_PARENT] as const;

/** May generate exports/reports. */
export const EXPORT_ROLES = [
  HouseholdRole.OWNER,
  HouseholdRole.CO_PARENT,
  HouseholdRole.CAREGIVER,
] as const;

/** May invite/remove members, change roles, rename/delete the household. */
export const OWNER_ROLES = [HouseholdRole.OWNER] as const;

/**
 * Roles that can be granted through an invite. `OWNER` is excluded on
 * purpose: ownership transfer is a separate, deliberate act on an existing
 * member (`PATCH .../members/:userId`), never something a shared link grants.
 */
export const INVITABLE_ROLES = [
  HouseholdRole.CO_PARENT,
  HouseholdRole.CAREGIVER,
  HouseholdRole.OBSERVER,
] as const;

/** Every action the permission model distinguishes. */
export type HouseholdPermission =
  | 'readData'
  | 'recordEntry'
  | 'editOwnEntry'
  | 'editAnyEntry'
  | 'deleteEntry'
  | 'manageChildren'
  | 'export'
  | 'manageMembers'
  | 'renameHousehold'
  | 'ownNotificationSettings';

/**
 * The permission matrix from the Phase 7.5 roadmap entry, as data. Nothing
 * reads this at runtime — it is the single declarative reference the role
 * bundles above are checked against, and the place to look when asking "may a
 * Betreuer do X?".
 */
export const HOUSEHOLD_PERMISSION_MATRIX: Readonly<
  Record<HouseholdPermission, readonly HouseholdRole[]>
> = {
  readData: ALL_ROLES,
  recordEntry: ENTRY_WRITE_ROLES,
  editOwnEntry: ENTRY_WRITE_ROLES,
  editAnyEntry: FULL_WRITE_ROLES,
  deleteEntry: FULL_WRITE_ROLES,
  manageChildren: FULL_WRITE_ROLES,
  export: EXPORT_ROLES,
  manageMembers: OWNER_ROLES,
  renameHousehold: OWNER_ROLES,
  ownNotificationSettings: ALL_ROLES,
};
