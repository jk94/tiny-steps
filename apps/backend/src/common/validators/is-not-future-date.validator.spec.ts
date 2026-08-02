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
});
