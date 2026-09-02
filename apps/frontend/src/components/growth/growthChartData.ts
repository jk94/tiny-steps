import type {
  GrowthMeasurementSummary,
  GrowthPercentile,
  LengthMeasurementPosition,
} from '../../api/growth-api';
import type { GrowthMeasure } from '../../lib/growthMeasureVisuals';

/** One plotted measurement point for a single measure. */
export interface GrowthPoint {
  measurementId: string;
  /** X axis: the child's age at measurement time, in completed days. */
  ageInDays: number;
  /** Y axis: the value in its base unit (grams or millimetres). */
  value: number;
  measuredAt: string;
  percentile: GrowthPercentile | null;
  /**
   * The measurement method attributed to this point (W-19). Only meaningful
   * for the body measure; null for weight and head circumference.
   */
  position: LengthMeasurementPosition | null;
}

/** Which stored field and percentile slot each measure reads. */
const MEASURE_FIELDS = {
  WEIGHT: { value: 'weightGrams', percentile: 'weight' },
  LENGTH: { value: 'lengthMillimeters', percentile: 'length' },
  HEAD_CIRCUMFERENCE: {
    value: 'headCircumferenceMillimeters',
    percentile: 'headCircumference',
  },
} as const satisfies Record<
  GrowthMeasure,
  {
    value: keyof GrowthMeasurementSummary;
    percentile: keyof GrowthMeasurementSummary['percentiles'];
  }
>;

/**
 * Projects the measurement list onto the series for one measure, dropping
 * every measurement that does not carry that value (all three are
 * individually optional — W-2) and sorting by age so the line and the cursor's
 * nearest-point search can both assume a monotone x axis.
 */
export function toGrowthSeries(
  measurements: GrowthMeasurementSummary[],
  measure: GrowthMeasure,
): GrowthPoint[] {
  const fields = MEASURE_FIELDS[measure];

  return measurements
    .filter((measurement) => measurement[fields.value] !== null)
    .map((measurement) => ({
      measurementId: measurement.id,
      ageInDays: measurement.ageInDaysAtMeasurement,
      value: measurement[fields.value] as number,
      measuredAt: measurement.measuredAt,
      percentile: measurement.percentiles[fields.percentile],
      position: measure === 'LENGTH' ? measurement.effectiveLengthMeasurementPosition : null,
    }))
    .sort((a, b) => a.ageInDays - b.ageInDays);
}

/**
 * Index of the series point closest to `ageInDays`, ties going to the earlier
 * point. Returns null for an empty series.
 *
 * A linear scan rather than a bisector: a child accumulates on the order of
 * ten measurements over five years, so the binary search would be pure
 * ceremony — and this stays correct without requiring the caller to prove the
 * array is sorted.
 */
export function nearestPointIndex(series: GrowthPoint[], ageInDays: number): number | null {
  if (series.length === 0) {
    return null;
  }

  let bestIndex = 0;
  let bestDistance = Math.abs(series[0].ageInDays - ageInDays);
  for (let index = 1; index < series.length; index += 1) {
    const distance = Math.abs(series[index].ageInDays - ageInDays);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  return bestIndex;
}
