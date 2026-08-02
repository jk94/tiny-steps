/**
 * Which side breastfeeding occurred on. Only meaningful when
 * `FeedingDetail.feedingType` is `BREAST`.
 *
 * Persisted as a plain `String` column on `FeedingDetail.side`, not a
 * Prisma `enum`, for the same reason as `FeedingType` — Prisma's `enum`
 * type is not supported on the SQLite connector. See
 * `docs/adr/0002-application-level-household-roles-and-invites.md`.
 * Enforced at the application layer via `toFeedingSide()`; since the DB
 * column is untyped, always read feeding sides through it rather than
 * comparing raw strings.
 */
export enum FeedingSide {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

/**
 * Validates and casts a raw string (e.g. read from `FeedingDetail.side`)
 * into a `FeedingSide`. Throws on any value that isn't a known side — this
 * is the defensive boundary that makes up for the DB column not being
 * type-checked at the schema level.
 */
export function toFeedingSide(value: string): FeedingSide {
  if (isFeedingSide(value)) {
    return value;
  }
  throw new Error(`Invalid FeedingSide: ${value}`);
}

function isFeedingSide(value: string): value is FeedingSide {
  return Object.values(FeedingSide).includes(value as FeedingSide);
}
