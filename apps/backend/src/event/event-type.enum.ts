/**
 * Discriminates `Event.type` by the kind of tracking event it represents.
 * `FEEDING` and `SLEEP` are populated so far (see PRD 4.1/5.2) — `DIAPER`
 * is conceptually reserved for a later phase, not added yet.
 *
 * Persisted as a plain `String` column on `Event.type`, not a Prisma
 * `enum`, because Prisma's `enum` type is not supported on the SQLite
 * connector — this is permanent, not a migration stepping stone (same
 * rationale as `HouseholdRole`; see
 * `docs/adr/0002-application-level-household-roles-and-invites.md`).
 * Enforced at the application layer via `toEventType()`; since the DB
 * column is untyped, always read event types through it rather than
 * comparing raw strings.
 */
export enum EventType {
  FEEDING = 'FEEDING',
  SLEEP = 'SLEEP',
}

/**
 * Validates and casts a raw string (e.g. read from `Event.type`) into an
 * `EventType`. Throws on any value that isn't a known event type — this is
 * the defensive boundary that makes up for the DB column not being
 * type-checked at the schema level.
 */
export function toEventType(value: string): EventType {
  if (isEventType(value)) {
    return value;
  }
  throw new Error(`Invalid EventType: ${value}`);
}

function isEventType(value: string): value is EventType {
  return Object.values(EventType).includes(value as EventType);
}
