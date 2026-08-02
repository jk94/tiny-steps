/**
 * The kind of diaper change a `DiaperDetail` row records. See PRD 4.1.
 *
 * Persisted as a plain `String` column on `DiaperDetail.diaperType`, not
 * a Prisma `enum`, because Prisma's `enum` type is not supported on the
 * SQLite connector — this is permanent, not a migration stepping stone
 * (same rationale as `HouseholdRole`; see
 * `docs/adr/0002-application-level-household-roles-and-invites.md`).
 * Enforced at the application layer via `toDiaperType()`; since the DB
 * column is untyped, always read diaper types through it rather than
 * comparing raw strings.
 */
export enum DiaperType {
  PEE = 'PEE',
  STOOL = 'STOOL',
  BOTH = 'BOTH',
}

/**
 * Validates and casts a raw string (e.g. read from
 * `DiaperDetail.diaperType`) into a `DiaperType`. Throws on any value
 * that isn't a known diaper type — this is the defensive boundary that
 * makes up for the DB column not being type-checked at the schema level.
 */
export function toDiaperType(value: string): DiaperType {
  if (isDiaperType(value)) {
    return value;
  }
  throw new Error(`Invalid DiaperType: ${value}`);
}

function isDiaperType(value: string): value is DiaperType {
  return Object.values(DiaperType).includes(value as DiaperType);
}
