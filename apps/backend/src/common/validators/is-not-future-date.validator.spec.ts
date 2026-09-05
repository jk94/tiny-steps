import { IsNotFutureDateConstraint } from './is-not-future-date.validator';

describe('IsNotFutureDateConstraint', () => {
  const constraint = new IsNotFutureDateConstraint();

  it('accepts a date in the past', () => {
    expect(constraint.validate('2020-01-01T00:00:00.000Z')).toBe(true);
  });

  it('accepts the current instant', () => {
    const now = new Date().toISOString();
    expect(constraint.validate(now)).toBe(true);
  });

  it('rejects a date one day in the future', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(constraint.validate(tomorrow)).toBe(false);
  });

  it('rejects a non-date value', () => {
    expect(constraint.validate('not-a-date')).toBe(false);
    expect(constraint.validate(undefined)).toBe(false);
  });

  describe('date-only values', () => {
    // Pin the clock to noon UTC: "tomorrow's UTC calendar day" is then 12h
    // ahead, inside the ~14h max-UTC-offset tolerance, so the UTC+14 case below
    // is exercised deterministically no matter what wall-clock time the suite
    // runs at. Without this the assertion flips depending on the hour of day.
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const todayInUtc = () => new Date().toISOString().slice(0, 10);
    const dayOffset = (days: number) =>
      new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    it('accepts a past calendar day', () => {
      expect(constraint.validate('2020-01-01')).toBe(true);
    });

    it("accepts today's calendar day", () => {
      expect(constraint.validate(todayInUtc())).toBe(true);
    });

    it("accepts tomorrow's UTC day, which is still today in UTC+14", () => {
      // A user in Auckland/Kiritimati recording "today" sends a calendar day
      // that is already tomorrow in UTC — rejecting it would be wrong.
      expect(constraint.validate(dayOffset(1))).toBe(true);
    });

    it('rejects a calendar day that is in the future everywhere on Earth', () => {
      expect(constraint.validate(dayOffset(2))).toBe(false);
      expect(constraint.validate(dayOffset(30))).toBe(false);
    });

    it('still applies the strict instant rule to a full timestamp', () => {
      const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      expect(constraint.validate(inOneHour)).toBe(false);
    });
  });
});
