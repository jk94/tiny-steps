/** Milliseconds in one calendar-agnostic 24-hour day. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Age in **completed** days — the axis the WHO reference tables are indexed
 * by, and the same definition the backend applies
 * (`apps/backend/src/growth/percentiles/age-in-days.ts`).
 *
 * Kept as a separate, tiny frontend copy rather than shared through a package:
 * the two apps have no shared module boundary, and duplicating four lines is
 * cheaper than introducing one. The definition is pinned on both sides by
 * tests.
 *
 * Deliberately NOT `lib/childAge.ts`'s `ageInMonths`: that one reasons in
 * calendar months for human-readable copy, this one in raw days for the chart
 * axis.
 */
export function ageInDaysAt(birthDate: Date, at: Date): number {
  return Math.floor((at.getTime() - birthDate.getTime()) / MS_PER_DAY);
}
