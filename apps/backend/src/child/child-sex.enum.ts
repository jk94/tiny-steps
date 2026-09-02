/**
 * Biological sex of a child, as far as the WHO growth standards need it.
 *
 * Deliberately narrow: the ONLY consumer is the sex-specific reference-table
 * selection behind the growth percentiles (W-9). "Not specified" is modelled
 * as `null` on `Child.sex` rather than as a third enum member, because it is
 * the absence of the input the reference lookup needs — the app then shows
 * values and trends but no percentiles (W-10) instead of guessing a default.
 *
 * Persisted as a plain `String` column, not a Prisma `enum`, because Prisma's
 * `enum` type is not supported on the SQLite connector — permanent, not a
 * migration stepping stone (same rationale as `HouseholdRole`/`FeedingType`;
 * see `docs/adr/0002-application-level-household-roles-and-invites.md`).
 * Enforced at the application layer via `toChildSex()`; since the DB column is
 * untyped, always read the value through it rather than comparing raw strings.
 */
export enum ChildSex {
  FEMALE = 'FEMALE',
  MALE = 'MALE',
}

/**
 * Validates and casts a raw string (e.g. read from `Child.sex`) into a
 * `ChildSex`. Throws on any value that isn't a known sex — the defensive
 * boundary making up for the DB column not being type-checked at the schema
 * level. Only call this on a non-null value; `null` means "not specified" and
 * must be handled by the caller.
 */
export function toChildSex(value: string): ChildSex {
  if (isChildSex(value)) {
    return value;
  }
  throw new Error(`Invalid ChildSex: ${value}`);
}

function isChildSex(value: string): value is ChildSex {
  return Object.values(ChildSex).includes(value as ChildSex);
}
