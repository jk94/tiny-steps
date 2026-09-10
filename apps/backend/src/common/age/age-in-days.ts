/** Milliseconds in one calendar-agnostic 24-hour day. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Age in **completed** days at a given moment — the age axis the WHO reference
 * tables are indexed by (W-9), and the basis for the "at N months" copy shown
 * next to a milestone (M-6).
 *
 * Semantics: whole 24-hour periods elapsed since birth, i.e. the child is
 * "0 days old" until 24 hours after birth. `Child.birthDate` is stored as a
 * UTC-midnight instant, so this is effectively "calendar days since the birth
 * date" for any date-only timestamp.
 *
 * A date before the birth date yields a negative number. That is left to the
 * caller on purpose: rejecting it is a request-validation concern (W-5 / M-6,
 * enforced in the domain services), not something a pure lookup helper should
 * decide.
 *
 * Lives under `common/` rather than in the growth module since roadmap Phase
 * 7.2, when milestones became the second consumer.
 */
export function ageInDaysAt(birthDate: Date, at: Date): number {
  return Math.floor((at.getTime() - birthDate.getTime()) / MS_PER_DAY);
}
