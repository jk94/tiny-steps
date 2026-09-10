/**
 * Roles a `Membership` can carry within a `Household` (see PRD section 3):
 *
 * - `OWNER` (Elternteil) — full read/write plus household administration
 *   (invite/remove members, change roles, rename/delete the household).
 * - `CO_PARENT` — full read/write on the household's data, no administration.
 * - `CAREGIVER` (Betreuer) — may record entries and edit their *own*, may
 *   export, but may not delete, edit others' entries or manage child profiles.
 * - `OBSERVER` (Beobachter) — read-only, plus their own notification settings.
 *
 * Which role may do what is expressed once, declaratively, in
 * `household-permissions.ts`; routes reference the named bundles from there
 * rather than listing roles inline.
 *
 * Persisted as a plain `String` column on `Membership.role`, not a Prisma
 * `enum`, because Prisma's `enum` type is not supported on the SQLite
 * connector (schema validation fails with P1012). See
 * `docs/adr/0002-application-level-household-roles-and-invites.md` for the
 * full rationale. Since the DB column is untyped, always read roles through
 * `toHouseholdRole()` rather than comparing raw strings.
 */
export enum HouseholdRole {
  OWNER = 'OWNER',
  CO_PARENT = 'CO_PARENT',
  CAREGIVER = 'CAREGIVER',
  OBSERVER = 'OBSERVER',
}

/**
 * Validates and casts a raw string (e.g. read from `Membership.role`) into
 * a `HouseholdRole`. Throws on any value that isn't a known role — this is
 * the defensive boundary that makes up for the DB column not being
 * type-checked at the schema level.
 */
export function toHouseholdRole(value: string): HouseholdRole {
  if (isHouseholdRole(value)) {
    return value;
  }
  throw new Error(`Invalid HouseholdRole: ${value}`);
}

function isHouseholdRole(value: string): value is HouseholdRole {
  return Object.values(HouseholdRole).includes(value as HouseholdRole);
}
