import type {
  GrowthMeasurementSummary,
  GrowthReferenceResponse,
} from '../../../growth/growth.service';
import { getReportStrings } from '../report-i18n/report-i18n';
import { buildGrowthChartBlock } from './growth-chart-svg';

/**
 * These specs run in the plain Node test environment (no jsdom), which is the
 * point: they prove the shared chart component really does render server-side,
 * the single riskiest assumption behind the PDF report (see ADR-0015).
 */

function measurement(overrides: Partial<GrowthMeasurementSummary>): GrowthMeasurementSummary {
  return {
    id: 'm1',
    childId: 'c1',
    userId: 'u1',
    measuredAt: new Date('2026-01-15T00:00:00.000Z'),
    ageInDaysAtMeasurement: 30,
    weightGrams: 4200,
    lengthMillimeters: 540,
    headCircumferenceMillimeters: 370,
    lengthMeasurementPosition: null,
    effectiveLengthMeasurementPosition: 'LYING',
    lengthOrHeightReferenceUsed: 'LENGTH',
    note: null,
    createdAt: new Date('2026-01-15T00:00:00.000Z'),
    updatedAt: new Date('2026-01-15T00:00:00.000Z'),
    percentiles: { weight: null, length: null, headCircumference: null },
    ...overrides,
  };
}

const REFERENCE: GrowthReferenceResponse = {
  indicator: 'WEIGHT_FOR_AGE',
  sex: 'FEMALE',
  available: true,
  xUnit: 'DAYS',
  unit: 'GRAMS',
  ageRangeDays: [0, 1826],
  stepDays: 7,
  lengthToHeightBoundaryDays: 731,
  curves: [3, 15, 50, 85, 97].map((percentile) => ({
    percentile: percentile as 3 | 15 | 50 | 85 | 97,
    zScore: 0,
    points: Array.from({ length: 30 }, (_unused, week) => ({
      ageInDays: week * 7,
      value: 3200 + week * 90 + (percentile - 50) * 12,
    })),
  })),
};

const STRINGS = getReportStrings('de');

const SERIES = [
  measurement({ id: 'a', ageInDaysAtMeasurement: 0, weightGrams: 3300 }),
  measurement({ id: 'b', ageInDaysAtMeasurement: 60, weightGrams: 5100 }),
  measurement({ id: 'c', ageInDaysAtMeasurement: 130, weightGrams: 6800 }),
];

describe('buildGrowthChartBlock', () => {
  it('renders an SVG chart block titled after the measure', () => {
    const block = buildGrowthChartBlock({
      measure: 'WEIGHT',
      measurements: SERIES,
      reference: REFERENCE,
      strings: STRINGS,
    });

    expect(block).not.toBeNull();
    expect(block!.kind).toBe('chart');
    expect(block!.title).toBe('Gewicht im Verlauf');
    expect(block!.svg.startsWith('<svg')).toBe(true);
  });

  it('draws one marker per measurement carrying that measure', () => {
    const block = buildGrowthChartBlock({
      measure: 'WEIGHT',
      measurements: [...SERIES, measurement({ id: 'd', weightGrams: null })],
      reference: REFERENCE,
      strings: STRINGS,
    });

    expect(block!.svg.match(/data-testid="growth-series-marker"/g)).toHaveLength(SERIES.length);
  });

  it('emits literal colors from the generated report tokens', () => {
    const block = buildGrowthChartBlock({
      measure: 'WEIGHT',
      measurements: SERIES,
      reference: REFERENCE,
      strings: STRINGS,
    });

    // A leaked `var(--…)` would render the curve as nothing at all in a PDF.
    expect(block!.svg).not.toContain('var(--');
    expect(block!.svg).toMatch(/#[0-9a-f]{6}/i);
  });

  it('returns no block at all when the measure has no values (never bands alone)', () => {
    const block = buildGrowthChartBlock({
      measure: 'HEAD_CIRCUMFERENCE',
      measurements: [measurement({ headCircumferenceMillimeters: null })],
      reference: REFERENCE,
      strings: STRINGS,
    });

    expect(block).toBeNull();
  });

  it('returns no block for an empty measurement list', () => {
    expect(
      buildGrowthChartBlock({
        measure: 'WEIGHT',
        measurements: [],
        reference: REFERENCE,
        strings: STRINGS,
      }),
    ).toBeNull();
  });

  it('still draws the series when no reference is available (W-11)', () => {
    const block = buildGrowthChartBlock({
      measure: 'WEIGHT',
      measurements: SERIES,
      reference: {
        indicator: 'WEIGHT_FOR_AGE',
        sex: null,
        available: false,
        reason: 'CHILD_SEX_NOT_SET',
      },
      strings: STRINGS,
    });

    expect(block!.svg).toContain('data-testid="growth-series-line"');
    expect(block!.svg).not.toContain('growth-percentile-line-');
  });

  it('labels the age axis in years once the child is over two', () => {
    const block = buildGrowthChartBlock({
      measure: 'WEIGHT',
      measurements: [measurement({ id: 'old', ageInDaysAtMeasurement: 1200, weightGrams: 14000 })],
      reference: REFERENCE,
      strings: STRINGS,
    });

    expect(block!.svg).toContain('J</text>');
  });

  it('translates the chart title with the requested locale', () => {
    const block = buildGrowthChartBlock({
      measure: 'LENGTH',
      measurements: SERIES,
      reference: null,
      strings: getReportStrings('en'),
    });

    expect(block!.title).toBe('Length over time');
  });
});
