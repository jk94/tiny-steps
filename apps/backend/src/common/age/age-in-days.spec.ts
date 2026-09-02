import { ageInDaysAt } from './age-in-days';

const BIRTH_DATE = new Date('2025-03-01T00:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function offsetFromBirth(milliseconds: number): Date {
  return new Date(BIRTH_DATE.getTime() + milliseconds);
}

describe('ageInDaysAt', () => {
  it('is 0 at the moment of birth', () => {
    expect(ageInDaysAt(BIRTH_DATE, BIRTH_DATE)).toBe(0);
  });

  it('is still 0 one minute before the first 24 hours have elapsed', () => {
    expect(ageInDaysAt(BIRTH_DATE, offsetFromBirth(23 * HOUR_MS + 59 * MINUTE_MS))).toBe(0);
  });

  it('turns 1 exactly when 24 hours have elapsed', () => {
    expect(ageInDaysAt(BIRTH_DATE, offsetFromBirth(24 * HOUR_MS))).toBe(1);
  });

  it('counts completed days across the 24-month reference boundary', () => {
    expect(ageInDaysAt(BIRTH_DATE, new Date('2027-03-01T12:00:00.000Z'))).toBe(730);
    expect(ageInDaysAt(BIRTH_DATE, new Date('2027-03-02T00:00:00.000Z'))).toBe(731);
  });

  it('returns a negative number for a measurement before birth, leaving rejection to the caller', () => {
    expect(ageInDaysAt(BIRTH_DATE, offsetFromBirth(-24 * HOUR_MS))).toBe(-1);
  });
});
