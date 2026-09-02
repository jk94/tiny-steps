/**
 * Public entry point of the vendored WHO Child Growth Standards reference
 * data. Everything outside this directory imports from here, so the generated
 * `*.data.ts` modules stay an implementation detail of the conversion pipeline
 * (see `README.md` and `scripts/convert-who-tables.ts`).
 */
export { HEAD_CIRCUMFERENCE_FOR_AGE } from './head-circumference-for-age.data';
export {
  LENGTH_HEIGHT_FOR_AGE,
  LENGTH_TO_HEIGHT_BOUNDARY_DAYS,
} from './length-height-for-age.data';
export { WEIGHT_FOR_AGE } from './weight-for-age.data';
export type {
  BodyMeasureTable,
  IndicatorTable,
  LmsPoint,
  ReferenceDataProvenance,
} from './lms.types';

/**
 * Inclusive age range the WHO 0–5y standards cover, in completed days since
 * birth. `1826` is five years counted as 5 × 365.25 days rounded down — the
 * exact axis length of the vendored tables, asserted by the converter and by
 * `who-reference-data.spec.ts` rather than assumed here.
 */
export const REFERENCE_MIN_AGE_DAYS = 0;
export const REFERENCE_MAX_AGE_DAYS = 1826;
