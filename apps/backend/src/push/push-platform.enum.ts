/**
 * Discriminates a `PushSubscription.platform` — which native platform the FCM
 * registration token was issued for. Both are sent through FCM regardless (FCM
 * relays to APNs for iOS), so this is informational/diagnostic rather than
 * changing the send path.
 *
 * Persisted as a plain `String` column, not a Prisma `enum`, because Prisma's
 * `enum` type isn't supported on the SQLite connector — same rationale and
 * defensive-boundary pattern as `EventType`/`toEventType()`. Always read the
 * column through `toPushPlatform()` rather than comparing raw strings.
 */
export enum PushPlatform {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
}

/**
 * Validates and casts a raw string into a `PushPlatform`, throwing on any
 * unknown value — the application-layer check that stands in for the DB column
 * not being type-constrained. Mirrors `toEventType()`.
 */
export function toPushPlatform(value: string): PushPlatform {
  if (isPushPlatform(value)) {
    return value;
  }
  throw new Error(`Invalid PushPlatform: ${value}`);
}

function isPushPlatform(value: string): value is PushPlatform {
  return Object.values(PushPlatform).includes(value as PushPlatform);
}
