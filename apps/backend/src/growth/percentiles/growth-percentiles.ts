/**
 * WHO percentile / z-score computation (roadmap Phase 7.1, W-9 / W-10 / W-11 /
 * W-17 / W-18).
 *
 * Every function in this module is **pure and side-effect free**: no I/O, no
 * clock, no database. That is what makes the classification — the actual value
 * of the growth feature — verifiable against published WHO reference values in
 * `growth-percentiles.spec.ts`, and lets the export pipeline reuse the exact
 * same numbers the API returns.
 */
import {
  HEAD_CIRCUMFERENCE_FOR_AGE,
  LENGTH_HEIGHT_FOR_AGE,
  LENGTH_TO_HEIGHT_BOUNDARY_DAYS,
  REFERENCE_MAX_AGE_DAYS,
  REFERENCE_MIN_AGE_DAYS,
  WEIGHT_FOR_AGE,
  type LmsPoint,
} from '../reference-data';
import { cumulativeStandardNormal } from './standard-normal';

export type GrowthIndicator =
  'WEIGHT_FOR_AGE' | 'LENGTH_OR_HEIGHT_FOR_AGE' | 'HEAD_CIRCUMFERENCE_FOR_AGE';

export type ChildSexValue = 'FEMALE' | 'MALE';

export type LengthMeasurementPositionValue = 'LYING' | 'STANDING';

/** Which WHO body-measure table a length/height value was scored against. */
export type BodyMeasureReference = 'LENGTH' | 'HEIGHT';

/**
 * The percentile curves drawn as reference bands (W-12) and the exact z-scores
 * they correspond to. Named here rather than derived through an inverse-normal
 * function, so the bands the chart draws and the values the tests assert are
 * literally the same numbers.
 */
export const WHO_PERCENTILE_Z_SCORES = {
  3: -1.880794,
  15: -1.036433,
  50: 0,
  85: 1.036433,
  97: 1.880794,
} as const;

export type WhoPercentileBand = keyof typeof WHO_PERCENTILE_Z_SCORES;

export type GrowthPercentileOutcome =
  | {
      status: 'COMPUTED';
      zScore: number;
      percentile: number;
      referenceUsed: BodyMeasureReference | null;
    }
  | { status: 'UNAVAILABLE'; reason: 'CHILD_SEX_NOT_SET' | 'AGE_ABOVE_REFERENCE_RANGE' };

/** Unit conversions between this app's integer base units and the WHO tables. */
const GRAMS_PER_KILOGRAM = 1000;
const MILLIMETRES_PER_CENTIMETRE = 10;

/**
 * `L` values below this are treated as the degenerate L = 0 case, where the
 * Box-Cox transform collapses to a log-normal distribution. The WHO tables
 * store `L` with four decimals, so anything this close to zero *is* zero as
 * far as the published data is concerned.
 */
const L_ZERO_EPSILON = 1e-7;

const PERCENT_SCALE = 100;

/**
 * Picks the WHO body-measure reference for a measurement (W-17 / W-18).
 *
 * Without an override, the choice follows the child's age at measurement time:
 * recumbent length up to 24 months, standing height from 24 months. With an
 * override the parent's explicit choice wins — including when it contradicts
 * the age, which is deliberately allowed (a 3-year-old measured lying down, a
 * 20-month-old measured standing).
 *
 * Note that the auto choice is evaluated on every read, not frozen at creation
 * time: a measurement taken at 23 months keeps being scored against the length
 * table forever, because the age *at measurement time* never changes.
 */
export function resolveBodyMeasureReference(
  ageInDays: number,
  override: LengthMeasurementPositionValue | null,
): BodyMeasureReference {
  if (override) {
    return override === 'LYING' ? 'LENGTH' : 'HEIGHT';
  }
  return ageInDays < LENGTH_TO_HEIGHT_BOUNDARY_DAYS ? 'LENGTH' : 'HEIGHT';
}

/**
 * The z-score of `value` under the LMS distribution `point`, using the WHO
 * definition: `z = ((X/M)^L - 1) / (L * S)`, degenerating to `ln(X/M) / S`
 * when `L` is zero.
 *
 * `value` must already be in the table's own unit (kilograms / centimetres).
 */
export function zScoreFromLms(value: number, point: LmsPoint): number {
  const ratio = value / point.m;
  if (Math.abs(point.l) < L_ZERO_EPSILON) {
    return Math.log(ratio) / point.s;
  }
  return (Math.pow(ratio, point.l) - 1) / (point.l * point.s);
}

/**
 * Inverse of {@link zScoreFromLms}: the measurement value at a given z-score.
 * Used to draw the reference bands (W-12) and, in the tests, to reconstruct
 * known-z inputs from the vendored LMS parameters.
 */
export function valueFromZScore(zScore: number, point: LmsPoint): number {
  if (Math.abs(point.l) < L_ZERO_EPSILON) {
    return point.m * Math.exp(point.s * zScore);
  }
  return point.m * Math.pow(1 + point.l * point.s * zScore, 1 / point.l);
}

/** Percentile (0–100, unrounded) matching a z-score. */
export function percentileFromZScore(zScore: number): number {
  return PERCENT_SCALE * cumulativeStandardNormal(zScore);
}

/**
 * Looks up the LMS parameters for an age. Deliberately uses the **nearest grid
 * point without interpolation**: the WHO tables have one row per day, so the
 * worst-case error from rounding is half a day of growth — far below the
 * precision of a bathroom scale or a tape measure, and interpolating would
 * invent values the published standard does not contain.
 */
function lmsPointAt(points: LmsPoint[], ageInDays: number): LmsPoint {
  const clampedAge = Math.min(
    Math.max(Math.round(ageInDays), REFERENCE_MIN_AGE_DAYS),
    REFERENCE_MAX_AGE_DAYS,
  );
  // The age axis is contiguous and zero-based (asserted by the converter and
  // by who-reference-data.spec.ts), so the index is the age itself — offset by
  // the first row's age for the height table, which starts at the boundary.
  const index = clampedAge - points[0].ageInDays;
  return points[Math.min(Math.max(index, 0), points.length - 1)];
}

/** True when `points`' age axis actually contains `ageInDays`. */
function covers(points: LmsPoint[], ageInDays: number): boolean {
  const roundedAge = Math.round(ageInDays);
  return roundedAge >= points[0].ageInDays && roundedAge <= points[points.length - 1].ageInDays;
}

/**
 * Picks the body-measure LMS rows for one measurement.
 *
 * WHO publishes length-for-age and height-for-age as two age-disjoint halves
 * of a single table (0–730 days recumbent, 731–1826 days standing) — there is
 * no published "height at 400 days" or "length at 1200 days" row. So when a
 * manual position override (W-18) points at the half that does not cover the
 * child's age, the score is necessarily read from the half that does; the
 * override still determines the measurement method reported to the UI (W-19).
 *
 * WHO's own algorithm bridges that gap with a ±0.7 cm cross-adjustment of the
 * measured value. This app deliberately does not apply it (see
 * `reference-data/README.md`), so an out-of-range override is informational
 * only rather than silently scoring a three-year-old against a two-year-old
 * reference row.
 */
function bodyMeasurePoints(
  sexKey: 'male' | 'female',
  ageInDays: number,
  referenceUsed: BodyMeasureReference,
): LmsPoint[] {
  const requested =
    referenceUsed === 'LENGTH'
      ? LENGTH_HEIGHT_FOR_AGE[sexKey].length
      : LENGTH_HEIGHT_FOR_AGE[sexKey].height;
  if (covers(requested, ageInDays)) {
    return requested;
  }
  return referenceUsed === 'LENGTH'
    ? LENGTH_HEIGHT_FOR_AGE[sexKey].height
    : LENGTH_HEIGHT_FOR_AGE[sexKey].length;
}

interface IndicatorLookup {
  points: LmsPoint[];
  referenceUsed: BodyMeasureReference | null;
  /** Divisor turning this app's integer base unit into the table's unit. */
  baseUnitsPerTableUnit: number;
}

function resolveIndicatorLookup(
  indicator: GrowthIndicator,
  sex: ChildSexValue,
  ageInDays: number,
  bodyMeasurePositionOverride: LengthMeasurementPositionValue | null,
): IndicatorLookup {
  const sexKey = sex === 'MALE' ? 'male' : 'female';

  switch (indicator) {
    case 'WEIGHT_FOR_AGE':
      return {
        points: WEIGHT_FOR_AGE[sexKey],
        referenceUsed: null,
        baseUnitsPerTableUnit: GRAMS_PER_KILOGRAM,
      };
    case 'HEAD_CIRCUMFERENCE_FOR_AGE':
      return {
        points: HEAD_CIRCUMFERENCE_FOR_AGE[sexKey],
        referenceUsed: null,
        baseUnitsPerTableUnit: MILLIMETRES_PER_CENTIMETRE,
      };
    case 'LENGTH_OR_HEIGHT_FOR_AGE': {
      const referenceUsed = resolveBodyMeasureReference(ageInDays, bodyMeasurePositionOverride);
      // Deliberately NO WHO +-0.7 cm length/height cross-adjustment when the
      // chosen reference contradicts the age (W-18 explicitly allows that
      // combination): the measured value is compared to the reference as
      // entered, so the displayed percentile always reconciles with the number
      // the parent typed in. See reference-data/README.md and
      // `bodyMeasurePoints`.
      return {
        points: bodyMeasurePoints(sexKey, ageInDays, referenceUsed),
        referenceUsed,
        baseUnitsPerTableUnit: MILLIMETRES_PER_CENTIMETRE,
      };
    }
  }
}

/**
 * Classifies one measurement value against the WHO standards.
 *
 * Returns an explicit `UNAVAILABLE` outcome instead of guessing whenever the
 * mapping is not defined:
 * - no sex on the child profile (W-10) — a sex-neutral default would silently
 *   fabricate a classification, which is exactly what the requirement forbids;
 * - age past the end of the 0–5y standards (W-11).
 *
 * An age *below* zero is not handled here — `GrowthService` rejects a
 * measurement before the birth date outright (W-5).
 */
export function computeGrowthPercentile(params: {
  indicator: GrowthIndicator;
  sex: ChildSexValue | null;
  ageInDays: number;
  /** Grams for weight, millimetres for length/height and head circumference. */
  valueInBaseUnit: number;
  bodyMeasurePositionOverride?: LengthMeasurementPositionValue | null;
}): GrowthPercentileOutcome {
  const { indicator, sex, ageInDays, valueInBaseUnit } = params;

  if (sex === null) {
    return { status: 'UNAVAILABLE', reason: 'CHILD_SEX_NOT_SET' };
  }
  if (ageInDays > REFERENCE_MAX_AGE_DAYS) {
    return { status: 'UNAVAILABLE', reason: 'AGE_ABOVE_REFERENCE_RANGE' };
  }

  const lookup = resolveIndicatorLookup(
    indicator,
    sex,
    ageInDays,
    params.bodyMeasurePositionOverride ?? null,
  );
  const point = lmsPointAt(lookup.points, ageInDays);
  const valueInTableUnit = valueInBaseUnit / lookup.baseUnitsPerTableUnit;
  const zScore = zScoreFromLms(valueInTableUnit, point);

  return {
    status: 'COMPUTED',
    zScore,
    percentile: percentileFromZScore(zScore),
    referenceUsed: lookup.referenceUsed,
  };
}

/**
 * The LMS row a measurement would be scored against, exposed for the
 * reference-band endpoint so it samples exactly the same grid points the
 * percentile computation uses. Returns `null` past the reference range.
 */
export function lmsPointForIndicator(params: {
  indicator: GrowthIndicator;
  sex: ChildSexValue;
  ageInDays: number;
  bodyMeasurePositionOverride?: LengthMeasurementPositionValue | null;
}): { point: LmsPoint; referenceUsed: BodyMeasureReference | null; baseUnitsPerTableUnit: number } {
  const lookup = resolveIndicatorLookup(
    params.indicator,
    params.sex,
    params.ageInDays,
    params.bodyMeasurePositionOverride ?? null,
  );
  return {
    point: lmsPointAt(lookup.points, params.ageInDays),
    referenceUsed: lookup.referenceUsed,
    baseUnitsPerTableUnit: lookup.baseUnitsPerTableUnit,
  };
}
