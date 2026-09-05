import { ageInDaysAt } from '../../../common/age/age-in-days';
import { ageInMonthsAt } from '../../../common/age/age-in-months';
import type { ReportLocale } from '../report-document.types';
import type { ReportStrings } from './report-i18n';

/**
 * Locale-aware value formatting for the report.
 *
 * Everything here takes the report's `locale` explicitly and never reads a
 * server default: EXP-8 requires the whole document to be in the language the
 * client asked for, and `Intl` would otherwise silently follow the host's
 * `LANG`.
 */

/** Both display units are shown with one decimal (kg and cm) — matches W-3. */
const VALUE_FRACTION_DIGITS = 1;

const GRAMS_PER_KILOGRAM = 1000;
const MILLIMETRES_PER_CENTIMETRE = 10;

const MONTHS_PER_YEAR = 12;

/**
 * A calendar day as `YYYY-MM-DD` UTC.
 *
 * `timeZone: 'UTC'` is not optional: `measuredAt`/`achievedAt`/`dueAt` are
 * stored as UTC-midnight instants standing for a bare calendar day, so
 * formatting them in the server's local zone would shift half the world's
 * dates by one day (the same bug Phase 7.3's review found in the scheduler).
 */
export function formatReportDate(locale: ReportLocale, value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * A real instant, shown with its time.
 *
 * Also rendered in UTC, and for the same reason the rest of this codebase does
 * no timezone reasoning server-side (see `EventController`): the backend does
 * not know the reader's zone, so it states one unambiguously rather than
 * guessing.
 */
export function formatReportDateTime(locale: ReportLocale, value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatReportNumber(
  locale: ReportLocale,
  value: number,
  fractionDigits = VALUE_FRACTION_DIGITS,
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Stored grams as displayed kilograms. */
export function formatKilograms(locale: ReportLocale, grams: number): string {
  return formatReportNumber(locale, grams / GRAMS_PER_KILOGRAM);
}

/** Stored millimetres as displayed centimetres. */
export function formatCentimetres(locale: ReportLocale, millimetres: number): string {
  return formatReportNumber(locale, millimetres / MILLIMETRES_PER_CENTIMETRE);
}

/**
 * Rounds a raw percentile for display, clamping the extremes away from 0/100 —
 * the same rule `apps/frontend/src/lib/growthFormat.ts` applies, so a report
 * never prints a percentile the app would have shown differently.
 */
export function formatPercentile(locale: ReportLocale, percentile: number): string {
  const clamped = Math.min(Math.max(percentile, 1), 99);
  return formatReportNumber(locale, clamped, 0);
}

/**
 * A child's age as "2 Jahre, 3 Monate" — or in days while still under a month,
 * where months would round a newborn's age to a meaningless "0 Monate".
 */
export function formatAge(strings: ReportStrings, birthDate: Date, at: Date): string {
  const totalMonths = ageInMonthsAt(birthDate, at);

  if (totalMonths < 1) {
    return strings.t('age.days', { count: Math.max(ageInDaysAt(birthDate, at), 0) });
  }

  const years = Math.floor(totalMonths / MONTHS_PER_YEAR);
  const months = totalMonths % MONTHS_PER_YEAR;

  if (years === 0) {
    return strings.t('age.months', { count: months });
  }
  if (months === 0) {
    return strings.t('age.years', { count: years });
  }
  return strings.t('age.yearsAndMonths', {
    years: strings.t('age.years', { count: years }),
    months: strings.t('age.months', { count: months }),
  });
}
