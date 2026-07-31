/**
 * Roles a `Membership` can carry within a `Household`. MVP only defines
 * `OWNER`/`CO_PARENT` (see PRD section 3) — `Betreuer`/`Beobachter` are
 * later additions.
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
