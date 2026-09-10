import { ageInMonthsAt } from './age-in-months';

const BIRTH_DATE = new Date('2025-01-20T00:00:00.000Z');

describe('ageInMonthsAt', () => {
  it('is 0 on the birth date itself', () => {
    expect(ageInMonthsAt(BIRTH_DATE, new Date('2025-01-20T00:00:00.000Z'))).toBe(0);
  });

  it('only flips over once the birth day-of-month is reached again', () => {
    expect(ageInMonthsAt(BIRTH_DATE, new Date('2025-02-19T00:00:00.000Z'))).toBe(0);
    expect(ageInMonthsAt(BIRTH_DATE, new Date('2025-02-20T00:00:00.000Z'))).toBe(1);
  });

  it('counts across a year boundary as a total month count', () => {
    expect(ageInMonthsAt(BIRTH_DATE, new Date('2026-07-20T00:00:00.000Z'))).toBe(18);
  });

  it('treats a birth day-of-month missing from the target month as its last day', () => {
    // Born on the 31st: the age must flip over on 28 February rather than
    // staying a month behind for the whole month.
    const bornOn31st = new Date('2025-01-31T00:00:00.000Z');
    expect(ageInMonthsAt(bornOn31st, new Date('2025-02-27T00:00:00.000Z'))).toBe(0);
    expect(ageInMonthsAt(bornOn31st, new Date('2025-02-28T00:00:00.000Z'))).toBe(1);
  });

  it('floors at 0 for a date before the birth date', () => {
    expect(ageInMonthsAt(BIRTH_DATE, new Date('2024-11-01T00:00:00.000Z'))).toBe(0);
  });
});
