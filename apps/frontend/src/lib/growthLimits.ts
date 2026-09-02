import type { GrowthMeasure } from './growthMeasureVisuals';
import { gramsToKilograms, millimetresToCentimetres } from './growthUnits';

/**
 * Plausibility limits for growth measurements (W-4), in the internal base
 * units (grams / millimetres).
 *
 * These MUST stay identical to
 * `apps/backend/src/growth/growth-measurement.constants.ts` — the server is
 * the authority, this copy exists so the form can reject an obvious typo
 * before a round-trip and name the offending bound in the error message.
 */
export const MIN_WEIGHT_GRAMS = 200;
export const MAX_WEIGHT_GRAMS = 60_000;

export const MIN_LENGTH_MILLIMETERS = 200;
export const MAX_LENGTH_MILLIMETERS = 1_500;

export const MIN_HEAD_CIRCUMFERENCE_MILLIMETERS = 200;
export const MAX_HEAD_CIRCUMFERENCE_MILLIMETERS = 700;

export const MAX_NOTE_LENGTH = 500;

export interface GrowthMeasureLimits {
  /** Inclusive bounds in the base unit. */
  min: number;
  max: number;
  /** The same bounds in the unit the form input works in. */
  minDisplay: number;
  maxDisplay: number;
}

export const growthMeasureLimits: Record<GrowthMeasure, GrowthMeasureLimits> = {
  WEIGHT: {
    min: MIN_WEIGHT_GRAMS,
    max: MAX_WEIGHT_GRAMS,
    minDisplay: gramsToKilograms(MIN_WEIGHT_GRAMS),
    maxDisplay: gramsToKilograms(MAX_WEIGHT_GRAMS),
  },
  LENGTH: {
    min: MIN_LENGTH_MILLIMETERS,
    max: MAX_LENGTH_MILLIMETERS,
    minDisplay: millimetresToCentimetres(MIN_LENGTH_MILLIMETERS),
    maxDisplay: millimetresToCentimetres(MAX_LENGTH_MILLIMETERS),
  },
  HEAD_CIRCUMFERENCE: {
    min: MIN_HEAD_CIRCUMFERENCE_MILLIMETERS,
    max: MAX_HEAD_CIRCUMFERENCE_MILLIMETERS,
    minDisplay: millimetresToCentimetres(MIN_HEAD_CIRCUMFERENCE_MILLIMETERS),
    maxDisplay: millimetresToCentimetres(MAX_HEAD_CIRCUMFERENCE_MILLIMETERS),
  },
};

/** True when `value` (base unit) is inside the measure's plausibility range. */
export function isWithinGrowthLimits(measure: GrowthMeasure, value: number): boolean {
  const { min, max } = growthMeasureLimits[measure];
  return value >= min && value <= max;
}
