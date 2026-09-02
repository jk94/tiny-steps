import { gramsToKilograms, millimetresToCentimetres } from './growthUnits';
import type { GrowthMeasure } from './growthMeasureVisuals';

/**
 * Display formatting for growth values and percentiles.
 *
 * Kept out of the components so the chart tooltip, the list rows and the
 * ChildHome card all render "6,4" (or "6.4") from the same code path — a
 * measurement that reads differently in two places looks like two different
 * measurements.
 */

/** Both display units are shown with one decimal (kg and cm) — W-3. */
const VALUE_FRACTION_DIGITS = 1;
/** Percentiles are whole numbers; a "42.7th percentile" implies false precision. */
const PERCENTILE_FRACTION_DIGITS = 0;

/** Converts a stored base-unit value into its display unit (kg or cm). */
export function toDisplayValue(measure: GrowthMeasure, valueInBaseUnit: number): number {
  return measure === 'WEIGHT'
    ? gramsToKilograms(valueInBaseUnit)
    : millimetresToCentimetres(valueInBaseUnit);
}

/** Formats a stored base-unit value in the user's locale, without the unit. */
export function formatGrowthValue(
  measure: GrowthMeasure,
  valueInBaseUnit: number,
  language: string,
): string {
  return toDisplayValue(measure, valueInBaseUnit).toLocaleString(language, {
    minimumFractionDigits: VALUE_FRACTION_DIGITS,
    maximumFractionDigits: VALUE_FRACTION_DIGITS,
  });
}

/**
 * Rounds a raw percentile for display, clamping the extremes away from 0/100:
 * a value can be at the 1st or the 99th percentile, but "0th" and "100th"
 * would suggest a child outside the entire population.
 */
export function formatPercentile(percentile: number, language: string): string {
  const clamped = Math.min(Math.max(percentile, 1), 99);
  return clamped.toLocaleString(language, {
    minimumFractionDigits: PERCENTILE_FRACTION_DIGITS,
    maximumFractionDigits: PERCENTILE_FRACTION_DIGITS,
  });
}

/** Formats a z-score with two decimals, the precision clinicians use. */
export function formatZScore(zScore: number, language: string): string {
  return zScore.toLocaleString(language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Reads the calendar day out of a `YYYY-MM-DD` (or leading-date) string as a
 * **local** `Date`.
 *
 * Deliberately parses the text rather than going through `new Date(value)`:
 * `measuredAt` is a calendar day stored as UTC midnight, so reading it back
 * through the local getters would land on the previous day for every browser
 * west of UTC — the same trap `lib/childAge.ts` documents for `birthDate`.
 * Returns `null` for anything unparseable.
 */
export function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Formats a stored calendar day in the user's locale, free of any day shift. */
export function formatCalendarDate(value: string, language: string): string {
  const date = parseCalendarDate(value);
  return date ? date.toLocaleDateString(language) : value;
}

/**
 * The `YYYY-MM-DD` value an `<input type="date">` needs for a stored calendar
 * day.
 *
 * The API returns `measuredAt` as a UTC-midnight instant
 * (`2025-04-01T00:00:00.000Z`), so slicing the string is already correct —
 * this exists so the intent (and the reason not to route it through
 * `new Date()`, which would shift the day west of UTC) is stated once instead
 * of being an unexplained `.slice(0, 10)` at each call site.
 */
export function toCalendarDateInputValue(value: string): string {
  return value.slice(0, 10);
}

/**
 * Today as `YYYY-MM-DD` in the **user's** timezone.
 *
 * `new Date().toISOString().slice(0, 10)` would give the UTC day, which is
 * still yesterday for anyone east of UTC late in their evening — so a parent
 * in Auckland could not pick today at all.
 */
export function todayAsCalendarDate(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
