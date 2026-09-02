const MONTHS_PER_YEAR = 12;

/**
 * Whole calendar months completed between two dates, rounded down — a child
 * born on the 20th only becomes "3 months old" on the 20th of the third
 * following month, not earlier.
 *
 * Computed from calendar fields rather than `msDiff / (30 days)`, which drifts
 * by a day or more per month and would flip the stated age a day early or late
 * depending on which months are crossed. Mirrors the frontend's
 * `lib/childAge.ts`, and the two are pinned by tests on both sides.
 *
 * Both arguments are read through their **UTC** getters: `Child.birthDate` and
 * `Milestone.achievedAt` are calendar days stored as UTC midnight, so reading
 * them through local getters would land on the previous day for every server
 * west of UTC.
 *
 * Returns 0 for a date before the birth date — "minus two months old" is not a
 * displayable age, and the request validation already rejects that case (M-6).
 */
export function ageInMonthsAt(birthDate: Date, at: Date): number {
  const elapsedMonths =
    (at.getUTCFullYear() - birthDate.getUTCFullYear()) * MONTHS_PER_YEAR +
    (at.getUTCMonth() - birthDate.getUTCMonth());
  // A birth day-of-month that doesn't exist in the target month (the 31st in
  // April, the 29th in a non-leap February) is treated as falling on that
  // month's last day — otherwise it would never be "reached" and the age would
  // stay a month behind for the whole month. Same convention as `date-fns`'
  // `differenceInMonths`.
  const daysInTargetMonth = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const effectiveBirthDay = Math.min(birthDate.getUTCDate(), daysInTargetMonth);
  const hasReachedBirthDayOfMonth = at.getUTCDate() >= effectiveBirthDay;

  return Math.max(0, hasReachedBirthDayOfMonth ? elapsedMonths : elapsedMonths - 1);
}
