import { describe, expect, it } from 'vitest';
import type { GrowthMeasurementSummary } from '../../api/growth-api';
import { nearestPointIndex, toGrowthSeries, type GrowthPoint } from './growthChartData';

function makeMeasurement(
  overrides: Partial<GrowthMeasurementSummary> = {},
): GrowthMeasurementSummary {
  return {
    id: 'm1',
    childId: 'c1',
    userId: 'u1',
    measuredAt: '2025-04-01T09:00:00.000Z',
    ageInDaysAtMeasurement: 90,
    weightGrams: 6400,
    lengthMillimeters: 615,
    headCircumferenceMillimeters: 405,
    lengthMeasurementPosition: null,
    effectiveLengthMeasurementPosition: 'LYING',
    lengthOrHeightReferenceUsed: 'LENGTH',
    note: null,
    createdAt: '2025-04-01T09:00:00.000Z',
    updatedAt: '2025-04-01T09:00:00.000Z',
    percentiles: {
      weight: { status: 'COMPUTED', zScore: 0.1, percentile: 54 },
      length: { status: 'COMPUTED', zScore: -0.2, percentile: 42 },
      headCircumference: null,
    },
    ...overrides,
  };
}

function point(ageInDays: number): GrowthPoint {
  return {
    measurementId: `m-${ageInDays}`,
    ageInDays,
    value: 1000 + ageInDays,
    measuredAt: '2025-04-01T09:00:00.000Z',
    percentile: null,
    position: null,
  };
}

describe('toGrowthSeries', () => {
  it('projects the weight values onto the series', () => {
    const series = toGrowthSeries([makeMeasurement()], 'WEIGHT');

    expect(series).toEqual([
      {
        measurementId: 'm1',
        ageInDays: 90,
        value: 6400,
        measuredAt: '2025-04-01T09:00:00.000Z',
        percentile: { status: 'COMPUTED', zScore: 0.1, percentile: 54 },
        position: null,
      },
    ]);
  });

  it('drops measurements that do not carry the selected value (W-2)', () => {
    const measurements = [
      makeMeasurement({ id: 'with', headCircumferenceMillimeters: 405 }),
      makeMeasurement({ id: 'without', headCircumferenceMillimeters: null }),
    ];

    expect(toGrowthSeries(measurements, 'HEAD_CIRCUMFERENCE').map((p) => p.measurementId)).toEqual([
      'with',
    ]);
  });

  it('carries the effective measurement method on the body measure only (W-19)', () => {
    const [lengthPoint] = toGrowthSeries([makeMeasurement()], 'LENGTH');
    const [weightPoint] = toGrowthSeries([makeMeasurement()], 'WEIGHT');

    expect(lengthPoint.position).toBe('LYING');
    expect(weightPoint.position).toBeNull();
  });

  it('drops a measurement with a negative age, which has no place on the axis', () => {
    const measurements = [
      makeMeasurement({ id: 'valid', ageInDaysAtMeasurement: 30 }),
      makeMeasurement({ id: 'before-birth', ageInDaysAtMeasurement: -5 }),
    ];

    expect(toGrowthSeries(measurements, 'WEIGHT').map((p) => p.measurementId)).toEqual(['valid']);
  });

  it('sorts by age so the line and the cursor can assume a monotone x axis', () => {
    const measurements = [
      makeMeasurement({ id: 'late', ageInDaysAtMeasurement: 365 }),
      makeMeasurement({ id: 'early', ageInDaysAtMeasurement: 30 }),
      makeMeasurement({ id: 'middle', ageInDaysAtMeasurement: 180 }),
    ];

    expect(toGrowthSeries(measurements, 'WEIGHT').map((p) => p.measurementId)).toEqual([
      'early',
      'middle',
      'late',
    ]);
  });
});

describe('nearestPointIndex', () => {
  const series = [point(0), point(90), point(365)];

  it('returns null for an empty series', () => {
    expect(nearestPointIndex([], 100)).toBeNull();
  });

  it.each([
    [0, 0],
    [40, 0],
    [50, 1],
    [90, 1],
    [300, 2],
    [10_000, 2],
    [-500, 0],
  ])('maps age %i to point index %i', (ageInDays, expected) => {
    expect(nearestPointIndex(series, ageInDays)).toBe(expected);
  });

  it('resolves an exact tie towards the earlier point', () => {
    expect(nearestPointIndex([point(0), point(100)], 50)).toBe(0);
  });
});
