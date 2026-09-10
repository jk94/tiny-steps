/**
 * Calendar-day helpers for the columns this app stores as a *day* rather than
 * an instant (`Child.birthDate`, `GrowthMeasurement.measuredAt`,
 * `Milestone.achievedAt`).
 *
 * Extracted from `growthFormat.ts` in roadmap Phase 7.2, when milestones
 * became the second consumer — the day-shift traps below are the same for
 * every such column, and a second copy would be one refactor away from
 * disagreeing about which day it is.
 */

/**
 * Reads the calendar day out of a `YYYY-MM-DD` (or leading-date) string as a
 * **local** `Date`.
 *
 * Deliberately parses the text rather than going through `new Date(value)`:
 * the value is a calendar day stored as UTC midnight, so reading it back
 * through the local getters would land on the previous day for every browser
 * west of UTC — the same trap `lib/childAge.ts` documents for `birthDate`.
 * Returns `null` for anything unparseable.
 */
export function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Formats a stored calendar day in the user's locale, free of any day shift. */
export function formatCalendarDate(value: string, language: string): string {
  const date = parseCalendarDate(value);
  return date ? date.toLocaleDateString(language) : value;
}

/**
 * The `YYYY-MM-DD` value an `<input type="date">` needs for a stored calendar
 * day.
 *
 * The API returns such a day as a UTC-midnight instant
 * (`2025-04-01T00:00:00.000Z`), so slicing the string is already correct —
 * this exists so the intent (and the reason not to route it through
 * `new Date()`, which would shift the day west of UTC) is stated once instead
 * of being an unexplained `.slice(0, 10)` at each call site.
 */
export function toCalendarDateInputValue(value: string): string {
  return value.slice(0, 10);
}

/**
 * Today as `YYYY-MM-DD` in the **user's** timezone.
 *
 * `new Date().toISOString().slice(0, 10)` would give the UTC day, which is
 * still yesterday for anyone east of UTC late in their evening — so a parent
 * in Auckland could not pick today at all.
 */
export function todayAsCalendarDate(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
