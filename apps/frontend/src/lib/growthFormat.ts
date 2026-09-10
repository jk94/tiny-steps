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
