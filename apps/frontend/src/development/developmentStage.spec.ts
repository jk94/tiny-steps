import { describe, expect, it } from 'vitest';
import {
  ALL_DEVELOPMENT_STAGES,
  adjacentStages,
  developmentStageAt,
  developmentStageKey,
  parseDevelopmentStageKey,
} from './developmentStage';

/** Local-time `now` values, so these assertions hold in any test-runner timezone. */
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

describe('developmentStageAt', () => {
  it('starts at week 1 on the day of birth and keeps it for seven days', () => {
    expect(developmentStageAt('2026-03-01', localDate(2026, 3, 1))).toEqual({
      kind: 'week',
      number: 1,
    });
    expect(developmentStageAt('2026-03-01', localDate(2026, 3, 7))).toEqual({
      kind: 'week',
      number: 1,
    });
    expect(developmentStageAt('2026-03-01', localDate(2026, 3, 8))).toEqual({
      kind: 'week',
      number: 2,
    });
  });

  it('counts weeks from the stored UTC-midnight birth date without a day shift', () => {
    expect(developmentStageAt('2026-03-01T00:00:00.000Z', localDate(2026, 3, 8))).toEqual({
      kind: 'week',
      number: 2,
    });
  });

  it('stays on week 52 for the last days before the first birthday', () => {
    // Day 364 would be "week 53"; the birthday itself is day 365.
    expect(developmentStageAt('2026-03-01', localDate(2027, 2, 28))).toEqual({
      kind: 'week',
      number: 52,
    });
  });

  it('switches to months on the first birthday', () => {
    expect(developmentStageAt('2026-03-01', localDate(2027, 3, 1))).toEqual({
      kind: 'month',
      number: 13,
    });
    expect(developmentStageAt('2026-03-01', localDate(2027, 9, 15))).toEqual({
      kind: 'month',
      number: 19,
    });
  });

  it('ends with month 36 and returns null from the third birthday on', () => {
    expect(developmentStageAt('2026-03-01', localDate(2029, 2, 28))).toEqual({
      kind: 'month',
      number: 36,
    });
    expect(developmentStageAt('2026-03-01', localDate(2029, 3, 1))).toBeNull();
  });

  it('floors a future birth date at week 1', () => {
    expect(developmentStageAt('2026-05-01', localDate(2026, 3, 1))).toEqual({
      kind: 'week',
      number: 1,
    });
  });
});

describe('stage keys', () => {
  it('lists 52 weeks followed by months 13–36', () => {
    expect(ALL_DEVELOPMENT_STAGES).toHaveLength(76);
    expect(ALL_DEVELOPMENT_STAGES[0]).toEqual({ kind: 'week', number: 1 });
    expect(ALL_DEVELOPMENT_STAGES[51]).toEqual({ kind: 'week', number: 52 });
    expect(ALL_DEVELOPMENT_STAGES[52]).toEqual({ kind: 'month', number: 13 });
    expect(ALL_DEVELOPMENT_STAGES[75]).toEqual({ kind: 'month', number: 36 });
  });

  it('round-trips every stage through its key', () => {
    for (const stage of ALL_DEVELOPMENT_STAGES) {
      expect(parseDevelopmentStageKey(developmentStageKey(stage))).toEqual(stage);
    }
  });

  it.each(['week-0', 'week-53', 'month-12', 'month-37', 'week-1x', 'day-3', ''])(
    'rejects %j',
    (key) => {
      expect(parseDevelopmentStageKey(key)).toBeNull();
    },
  );
});

describe('adjacentStages', () => {
  it('has no previous stage at week 1 and no next stage at month 36', () => {
    expect(adjacentStages({ kind: 'week', number: 1 })).toEqual({
      previous: null,
      next: { kind: 'week', number: 2 },
    });
    expect(adjacentStages({ kind: 'month', number: 36 })).toEqual({
      previous: { kind: 'month', number: 35 },
      next: null,
    });
  });

  it('crosses from week 52 to month 13', () => {
    expect(adjacentStages({ kind: 'week', number: 52 }).next).toEqual({
      kind: 'month',
      number: 13,
    });
    expect(adjacentStages({ kind: 'month', number: 13 }).previous).toEqual({
      kind: 'week',
      number: 52,
    });
  });
});
