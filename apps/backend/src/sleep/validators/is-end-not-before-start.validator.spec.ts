import { ValidationArguments } from 'class-validator';
import { IsEndNotBeforeStartConstraint } from './is-end-not-before-start.validator';

function args(object: Record<string, unknown>): ValidationArguments {
  return {
    value: object.endedAt,
    constraints: ['startedAt'],
    targetName: 'CreateSleepEventDto',
    object,
    property: 'endedAt',
  };
}

describe('IsEndNotBeforeStartConstraint', () => {
  const constraint = new IsEndNotBeforeStartConstraint();

  it('accepts endedAt equal to startedAt', () => {
    const object = {
      startedAt: '2026-01-01T10:00:00.000Z',
      endedAt: '2026-01-01T10:00:00.000Z',
    };
    expect(constraint.validate(object.endedAt, args(object))).toBe(true);
  });

  it('accepts endedAt after startedAt', () => {
    const object = {
      startedAt: '2026-01-01T10:00:00.000Z',
      endedAt: '2026-01-01T10:20:00.000Z',
    };
    expect(constraint.validate(object.endedAt, args(object))).toBe(true);
  });

  it('rejects endedAt before startedAt', () => {
    const object = {
      startedAt: '2026-01-01T10:20:00.000Z',
      endedAt: '2026-01-01T10:00:00.000Z',
    };
    expect(constraint.validate(object.endedAt, args(object))).toBe(false);
  });

  it('passes when startedAt is missing (nothing to compare against)', () => {
    const object = { endedAt: '2026-01-01T10:00:00.000Z' };
    expect(constraint.validate(object.endedAt, args(object))).toBe(true);
  });

  it('passes when endedAt is missing/not a string', () => {
    const object = { startedAt: '2026-01-01T10:00:00.000Z' };
    expect(constraint.validate(undefined, args(object))).toBe(true);
  });
});
