import { ageInDays, ageInMonths } from '../lib/childAge';

/**
 * The development calendar's two granularities: one entry per *Lebenswoche*
 * (week of life) through the first year, then one per *Lebensmonat* (month of
 * life) up to the third birthday. Week-precise texts past the first year would
 * be false precision — the sources this content draws on describe toddler
 * development in months, and wide ones at that.
 *
 * Both count from 1 in the German "n-th week/month of life" sense: Lebenswoche
 * 1 is days 0–6, and Lebensmonat 13 is the month after the first birthday
 * (12 completed months).
 */
export type DevelopmentStage = { kind: 'week'; number: number } | { kind: 'month'; number: number };

export const FIRST_YEAR_WEEKS = 52;
export const FIRST_MONTH_STAGE = 13;
export const LAST_MONTH_STAGE = 36;

const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;

/** Every stage of the calendar in reading order: weeks 1–52, then months 13–36. */
export const ALL_DEVELOPMENT_STAGES: readonly DevelopmentStage[] = [
  ...Array.from({ length: FIRST_YEAR_WEEKS }, (_, i) => ({ kind: 'week' as const, number: i + 1 })),
  ...Array.from({ length: LAST_MONTH_STAGE - FIRST_MONTH_STAGE + 1 }, (_, i) => ({
    kind: 'month' as const,
    number: FIRST_MONTH_STAGE + i,
  })),
];

/**
 * The stage a child of this birth date is in on `now`'s local calendar day, or
 * `null` once the child has completed its third year and the calendar has
 * nothing left to show.
 *
 * The switch from weeks to months happens at the first birthday, not after
 * day 364: 52 weeks are a day or two short of a year, and those last days stay
 * on week 52 rather than inventing a week 53.
 */
export function developmentStageAt(
  birthDate: string,
  now: Date = new Date(),
): DevelopmentStage | null {
  const months = ageInMonths(birthDate, now);

  if (months < MONTHS_PER_YEAR) {
    const week = Math.floor(ageInDays(birthDate, now) / DAYS_PER_WEEK) + 1;
    return { kind: 'week', number: Math.min(week, FIRST_YEAR_WEEKS) };
  }
  if (months < LAST_MONTH_STAGE) {
    return { kind: 'month', number: months + 1 };
  }
  return null;
}

/** The URL segment for a stage, e.g. `week-12` or `month-18`. */
export function developmentStageKey(stage: DevelopmentStage): string {
  return `${stage.kind}-${stage.number}`;
}

/** Parses a URL segment back into a stage; `null` for anything outside the calendar. */
export function parseDevelopmentStageKey(key: string): DevelopmentStage | null {
  const match = /^(week|month)-(\d{1,2})$/.exec(key);
  if (!match) {
    return null;
  }

  const stage: DevelopmentStage = {
    kind: match[1] as DevelopmentStage['kind'],
    number: Number(match[2]),
  };
  return ALL_DEVELOPMENT_STAGES.some((known) => isSameStage(known, stage)) ? stage : null;
}

export function isSameStage(a: DevelopmentStage, b: DevelopmentStage): boolean {
  return a.kind === b.kind && a.number === b.number;
}

/** The stages before and after this one in reading order, `null` at either end. */
export function adjacentStages(stage: DevelopmentStage): {
  previous: DevelopmentStage | null;
  next: DevelopmentStage | null;
} {
  const index = ALL_DEVELOPMENT_STAGES.findIndex((known) => isSameStage(known, stage));
  return {
    previous: ALL_DEVELOPMENT_STAGES[index - 1] ?? null,
    next: index === -1 ? null : (ALL_DEVELOPMENT_STAGES[index + 1] ?? null),
  };
}
