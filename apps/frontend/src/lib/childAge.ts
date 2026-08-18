const MONTHS_PER_YEAR = 12;

/** A calendar day with no time or timezone attached. */
interface CalendarDate {
  year: number;
  /** Zero-based, matching `Date.prototype.getMonth()`. */
  month: number;
  day: number;
}

/**
 * Reads the calendar day out of a `YYYY-MM-DD` or full ISO-8601 birth date.
 *
 * Deliberately parses the leading date part as text instead of going through
 * `new Date(...)`: a birth date is a calendar day, not an instant, but the
 * backend serializes it as a UTC-midnight instant (`2024-03-01T00:00:00.000Z`).
 * Reading that back through the local `getDate()` getters would land on the
 * previous day for every browser west of UTC — and thus report the wrong age
 * for the whole month following a birthday.
 */
function parseCalendarDate(birthDate: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  if (!match) {
    return null;
  }

  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

/**
 * Whole calendar months a child has completed, rounded down — a child born on
 * the 20th only becomes "3 months old" on the 20th of the third following
 * month, not earlier. Computed from calendar fields rather than
 * `msDiff / (30 days)`, which drifts by a day or more per month and would
 * flip the displayed age a day early or late depending on the months crossed.
 *
 * `now` is read through its local-time getters (same convention as
 * `dayBoundaries.ts`), so the age flips over at the user's local midnight.
 *
 * Ages past a year are still returned as a total month count ("18 months
 * old") rather than split into years + months: the app's copy has no
 * years/months variant, and month counts are how baby ages are stated for
 * most of the range this app targets.
 *
 * Returns 0 for an unparseable value or a birth date in the future — the
 * child form already rejects future birth dates (`birthDateFuture`), so this
 * is a defensive floor rather than a displayed state.
 */
export function ageInMonths(birthDate: string, now: Date = new Date()): number {
  const birth = parseCalendarDate(birthDate);
  if (!birth) {
    return 0;
  }

  const elapsedMonths =
    (now.getFullYear() - birth.year) * MONTHS_PER_YEAR + (now.getMonth() - birth.month);
  // The birth day-of-month hasn't come around yet this month, so the most
  // recent month isn't complete — round down by dropping it.
  const hasReachedBirthDayOfMonth = now.getDate() >= birth.day;

  return Math.max(0, hasReachedBirthDayOfMonth ? elapsedMonths : elapsedMonths - 1);
}
