/**
 * The kind of feeding a `FeedingDetail` row records. See PRD 4.1.
 *
 * Persisted as a plain `String` column on `FeedingDetail.feedingType`, not
 * a Prisma `enum`, because Prisma's `enum` type is not supported on the
 * SQLite connector — this is permanent, not a migration stepping stone
 * (same rationale as `HouseholdRole`; see
 * `docs/adr/0002-application-level-household-roles-and-invites.md`).
 * Enforced at the application layer via `toFeedingType()`; since the DB
 * column is untyped, always read feeding types through it rather than
 * comparing raw strings.
 */
export enum FeedingType {
  BREAST = 'BREAST',
  BOTTLE = 'BOTTLE',
  SOLID = 'SOLID',
}

/**
 * Validates and casts a raw string (e.g. read from
 * `FeedingDetail.feedingType`) into a `FeedingType`. Throws on any value
 * that isn't a known feeding type — this is the defensive boundary that
 * makes up for the DB column not being type-checked at the schema level.
 */
export function toFeedingType(value: string): FeedingType {
  if (isFeedingType(value)) {
    return value;
  }
  throw new Error(`Invalid FeedingType: ${value}`);
}

function isFeedingType(value: string): value is FeedingType {
  return Object.values(FeedingType).includes(value as FeedingType);
}
