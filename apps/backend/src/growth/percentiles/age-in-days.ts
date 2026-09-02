/** Milliseconds in one calendar-agnostic 24-hour day. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Age in **completed** days at the moment of a measurement — the age axis the
 * WHO reference tables are indexed by (W-9).
 *
 * Semantics: whole 24-hour periods elapsed since birth, i.e. the child is
 * "0 days old" until 24 hours after birth. `Child.birthDate` is stored as a
 * UTC-midnight instant, so this is effectively "calendar days since the birth
 * date" for any measurement timestamp.
 *
 * A measurement before the birth date yields a negative number. That is left
 * to the caller on purpose: rejecting it is a request-validation concern
 * (W-5, enforced in `GrowthService`), not something a pure lookup helper
 * should decide.
 */
export function ageInDaysAt(birthDate: Date, measuredAt: Date): number {
  return Math.floor((measuredAt.getTime() - birthDate.getTime()) / MS_PER_DAY);
}
