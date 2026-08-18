import { describe, expect, it } from 'vitest';
import { ageInMonths } from './childAge';

/** Local-time `now` values, so these assertions hold in any test-runner timezone. */
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

describe('ageInMonths', () => {
  it('is 0 for a child born today', () => {
    expect(ageInMonths('2026-03-14', localDate(2026, 3, 14))).toBe(0);
  });

  it('is 0 for a child born earlier this month', () => {
    expect(ageInMonths('2026-03-01', localDate(2026, 3, 31))).toBe(0);
  });

  it('flips to the next month exactly on the birth day-of-month', () => {
    expect(ageInMonths('2026-01-20', localDate(2026, 3, 19))).toBe(1);
    expect(ageInMonths('2026-01-20', localDate(2026, 3, 20))).toBe(2);
  });

  it('rounds down while the birth day-of-month is still ahead this month', () => {
    expect(ageInMonths('2025-11-25', localDate(2026, 3, 24))).toBe(3);
  });

  it("treats a shorter month's last day as the birth day-of-month it does not have", () => {
    // April has no 31st, so the 30th completes the month for a 31st-born child.
    expect(ageInMonths('2026-03-31', localDate(2026, 4, 29))).toBe(0);
    expect(ageInMonths('2026-03-31', localDate(2026, 4, 30))).toBe(1);
  });

  it('lets a Feb-29 birthday complete a year on Feb 28 of a non-leap year', () => {
    expect(ageInMonths('2024-02-29', localDate(2025, 2, 27))).toBe(11);
    expect(ageInMonths('2024-02-29', localDate(2025, 2, 28))).toBe(12);
  });

  it('keeps counting in total months past the first year', () => {
    expect(ageInMonths('2024-09-10', localDate(2026, 3, 14))).toBe(18);
  });

  it('accepts the full ISO-8601 instant the API actually returns, not just YYYY-MM-DD', () => {
    // A UTC-midnight instant must still be read as the 1st, even in a
    // timezone where that instant falls on the previous local day.
    expect(ageInMonths('2026-01-01T00:00:00.000Z', localDate(2026, 3, 1))).toBe(2);
  });

  it('floors at 0 for a birth date in the future', () => {
    expect(ageInMonths('2026-06-01', localDate(2026, 3, 14))).toBe(0);
  });

  it('falls back to 0 for an unparseable birth date rather than returning NaN', () => {
    expect(ageInMonths('', localDate(2026, 3, 14))).toBe(0);
    expect(ageInMonths('not-a-date', localDate(2026, 3, 14))).toBe(0);
  });
});
