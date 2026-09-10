/**
 * Plausibility limits and shared field metadata for growth measurements
 * (W-3 / W-4).
 *
 * Extracted from the DTOs because the create DTO, the update DTO and the
 * frontend form all have to agree on the exact same numbers — the frontend
 * mirrors these in `apps/frontend/src/lib/growthLimits.ts`, and any change
 * here must be made there too.
 *
 * All values are in this app's internal base units: **grams** for weight,
 * **millimetres** for length/height and head circumference. Nothing is ever
 * stored as a float; the UI converts from kg/cm on submit.
 */
export const MIN_WEIGHT_GRAMS = 200;
export const MAX_WEIGHT_GRAMS = 60_000;

export const MIN_LENGTH_MILLIMETERS = 200;
export const MAX_LENGTH_MILLIMETERS = 1_500;

export const MIN_HEAD_CIRCUMFERENCE_MILLIMETERS = 200;
export const MAX_HEAD_CIRCUMFERENCE_MILLIMETERS = 700;

export const MAX_NOTE_LENGTH = 500;

/**
 * The three measurement value fields. A measurement is only valid if at least
 * one of them carries a value (W-1); referenced by
 * `@AtLeastOneMeasurementValue()` and re-checked in `GrowthService.update()`
 * after merging a partial update with the stored row.
 */
export const MEASUREMENT_VALUE_FIELDS = [
  'weightGrams',
  'lengthMillimeters',
  'headCircumferenceMillimeters',
] as const;

export type MeasurementValueField = (typeof MEASUREMENT_VALUE_FIELDS)[number];
