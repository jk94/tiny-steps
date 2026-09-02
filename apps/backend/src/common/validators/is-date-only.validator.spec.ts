import { IsDateOnlyConstraint } from './is-date-only.validator';

describe('IsDateOnlyConstraint', () => {
  const constraint = new IsDateOnlyConstraint();

  it('accepts a bare calendar day', () => {
    expect(constraint.validate('2026-09-02')).toBe(true);
  });

  it('rejects a full instant, which would reintroduce the day-shift bug', () => {
    expect(constraint.validate('2026-09-02T12:00:00.000Z')).toBe(false);
    expect(constraint.validate('2026-09-02T00:00:00+02:00')).toBe(false);
  });

  it('rejects a malformed or non-string value', () => {
    expect(constraint.validate('02.09.2026')).toBe(false);
    expect(constraint.validate('2026-9-2')).toBe(false);
    expect(constraint.validate(undefined)).toBe(false);
    expect(constraint.validate(20260902)).toBe(false);
  });
});
