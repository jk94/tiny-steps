import { renderGrowthChartSvg } from '@baby-tracker/growth-chart-static/server';
import type {
  GrowthMeasurementSummary,
  GrowthReferenceResponse,
} from '../../../growth/growth.service';
import type { GrowthIndicator } from '../../../growth/percentiles/growth-percentiles';
import { reportTokens } from '../renderers/react-pdf/report-tokens.generated';
import { formatCentimetres, formatKilograms, formatReportNumber } from '../report-i18n/format';
import type { ReportStrings } from '../report-i18n/report-i18n';
import type { ChartBlock, ReportLocale } from '../report-document.types';

/**
 * Server-side rendering of the growth trend chart into a `ChartBlock` (EXP-4).
 *
 * The component itself is the very one the app draws on screen
 * (`@baby-tracker/growth-chart-static`), so the report cannot disagree with the
 * page it was generated from. Everything the browser supplies through the CSS
 * cascade and i18next is passed in explicitly here: literal hex from the
 * generated report tokens, and formatting functions bound to the report's
 * locale.
 */

/** The three measures a growth measurement can carry (W-2). */
export type ReportGrowthMeasure = 'WEIGHT' | 'LENGTH' | 'HEAD_CIRCUMFERENCE';

/**
 * Everything the report needs to know about one growth measure, in one place —
 * the same "one table per concept" discipline as the frontend's
 * `growthMeasureVisuals`/`growthMeasureFields`, so a fourth measure could never
 * be added to the chart but forgotten in the table.
 */
interface MeasureDefinition {
  indicator: GrowthIndicator;
  valueField: 'weightGrams' | 'lengthMillimeters' | 'headCircumferenceMillimeters';
  /** Which slot of `GrowthMeasurementSummary.percentiles` holds this measure. */
  percentileSlot: 'weight' | 'length' | 'headCircumference';
  colorToken: 'growth-weight' | 'growth-length' | 'growth-head-circumference';
  labelKey: 'growth.measure.weight' | 'growth.measure.length' | 'growth.measure.headCircumference';
  columnKey: 'growth.column.weight' | 'growth.column.length' | 'growth.column.headCircumference';
  formatValue: (locale: ReportLocale, valueInBaseUnit: number) => string;
}

/** Stable render order — the same one the app's measure tabs use. */
export const REPORT_GROWTH_MEASURES: ReportGrowthMeasure[] = [
  'WEIGHT',
  'LENGTH',
  'HEAD_CIRCUMFERENCE',
];

export const REPORT_GROWTH_MEASURE_DEFINITIONS: Record<ReportGrowthMeasure, MeasureDefinition> = {
  WEIGHT: {
    indicator: 'WEIGHT_FOR_AGE',
    valueField: 'weightGrams',
    percentileSlot: 'weight',
    colorToken: 'growth-weight',
    labelKey: 'growth.measure.weight',
    columnKey: 'growth.column.weight',
    formatValue: formatKilograms,
  },
  LENGTH: {
    indicator: 'LENGTH_OR_HEIGHT_FOR_AGE',
    valueField: 'lengthMillimeters',
    percentileSlot: 'length',
    colorToken: 'growth-length',
    labelKey: 'growth.measure.length',
    columnKey: 'growth.column.length',
    formatValue: formatCentimetres,
  },
  HEAD_CIRCUMFERENCE: {
    indicator: 'HEAD_CIRCUMFERENCE_FOR_AGE',
    valueField: 'headCircumferenceMillimeters',
    percentileSlot: 'headCircumference',
    colorToken: 'growth-head-circumference',
    labelKey: 'growth.measure.headCircumference',
    columnKey: 'growth.column.headCircumference',
    formatValue: formatCentimetres,
  },
};

/**
 * Chart size in PostScript points. A4 portrait is 595pt wide and the report
 * page has a 32pt margin on each side, so 531 is the full usable width; the
 * height keeps roughly the on-screen 2:1 aspect so the curve's slope reads the
 * same in print as it does on the page it came from.
 */
const CHART_WIDTH_POINTS = 531;
const CHART_HEIGHT_POINTS = 250;

const DAYS_PER_MONTH = 30.4375;
const DAYS_PER_YEAR = 365.25;
/** Below this age the x axis is labelled in months, above it in years. */
const MONTH_AXIS_MAX_DAYS = 2 * DAYS_PER_YEAR;

/**
 * Right edge of the age axis when the child has only one measurement (or all
 * of them on the same day): a zero-wide axis would collapse the plot.
 */
const MIN_AXIS_SPAN_DAYS = 30;

/**
 * Head-room past the newest measurement, so the last marker is not glued to
 * the right edge where the band labels are.
 */
const AXIS_HEADROOM_RATIO = 0.05;

export interface GrowthChartBlockInput {
  measure: ReportGrowthMeasure;
  measurements: GrowthMeasurementSummary[];
  /** The band data for this measure's indicator, or null when unavailable. */
  reference: GrowthReferenceResponse | null;
  strings: ReportStrings;
}

/**
 * Builds the chart block for one measure, or `null` when the child has no
 * value for that measure in the period.
 *
 * Bands alone are never drawn: a percentile background with no curve on it
 * tells a doctor nothing about *this* child, and would read as "the child has
 * no data" far less clearly than the section's `emptySectionNote` does.
 */
export function buildGrowthChartBlock({
  measure,
  measurements,
  reference,
  strings,
}: GrowthChartBlockInput): ChartBlock | null {
  const definition = REPORT_GROWTH_MEASURE_DEFINITIONS[measure];
  const locale = strings.locale;

  const series = measurements
    .filter(
      (measurement) =>
        measurement[definition.valueField] !== null && measurement.ageInDaysAtMeasurement >= 0,
    )
    .map((measurement) => ({
      id: measurement.id,
      ageInDays: measurement.ageInDaysAtMeasurement,
      value: measurement[definition.valueField] as number,
    }))
    .sort((a, b) => a.ageInDays - b.ageInDays);

  if (series.length === 0) {
    return null;
  }

  const newestAgeInDays = series[series.length - 1].ageInDays;
  const maxAgeDays = Math.max(
    Math.ceil(newestAgeInDays * (1 + AXIS_HEADROOM_RATIO)),
    MIN_AXIS_SPAN_DAYS,
  );

  const bands = reference?.available
    ? reference.curves.map((curve) => ({ percentile: curve.percentile, points: curve.points }))
    : [];

  const svg = renderGrowthChartSvg({
    width: CHART_WIDTH_POINTS,
    height: CHART_HEIGHT_POINTS,
    series,
    bands,
    maxAgeDays,
    colors: {
      series: reportTokens.color[definition.colorToken],
      band: reportTokens.color['growth-band'],
      axis: reportTokens.color.border,
      label: reportTokens.color['muted-foreground'],
      markerHalo: reportTokens.color.background,
    },
    formatValue: (valueInBaseUnit) => definition.formatValue(locale, valueInBaseUnit),
    formatAgeTick: (ageInDays) =>
      maxAgeDays <= MONTH_AXIS_MAX_DAYS
        ? strings.t('growth.axis.months', { count: Math.round(ageInDays / DAYS_PER_MONTH) })
        : strings.t('growth.axis.years', { count: Math.round(ageInDays / DAYS_PER_YEAR) }),
    formatBandLabel: (percentile) =>
      strings.t('growth.band.label', { percentile: formatReportNumber(locale, percentile, 0) }),
  });

  return {
    kind: 'chart',
    title: strings.t('growth.chart.title', { measure: strings.t(definition.labelKey) }),
    svg,
  };
}
