import type {
  GrowthMeasurementSummary,
  GrowthPercentile,
  GrowthReferenceResponse,
} from '../../../growth/growth.service';
import {
  REPORT_GROWTH_MEASURES,
  REPORT_GROWTH_MEASURE_DEFINITIONS,
  buildGrowthChartBlock,
} from '../chart/growth-chart-svg';
import type { ReportBlock } from '../report-document.types';
import { formatAge, formatPercentile, formatReportDate } from '../report-i18n/format';
import type { ReportStrings } from '../report-i18n/report-i18n';

export interface GrowthSectionInput {
  birthDate: Date;
  measurements: GrowthMeasurementSummary[];
  /** WHO bands per indicator, keyed by measure; missing/unavailable is fine. */
  references: Partial<Record<(typeof REPORT_GROWTH_MEASURES)[number], GrowthReferenceResponse>>;
  strings: ReportStrings;
}

/**
 * Renders one measurement's percentile for a measure.
 *
 * The value is taken **verbatim** from the summary the growth service already
 * computed — never recomputed here. Recomputing would mean a second derivation
 * of W-17/W-18/W-19's reference selection and the ±7 mm recumbent↔standing
 * adjustment, and the first time the two drifted, a printed report would
 * contradict the screen it was generated from.
 */
function percentileCell(strings: ReportStrings, percentile: GrowthPercentile | null): string {
  if (percentile === null || percentile.status !== 'COMPUTED') {
    // W-10/W-11: no sex on the profile, or an age outside the WHO range. An
    // empty cell is honest; a sentinel number would not be.
    return strings.t('growth.percentile.unavailable');
  }
  return strings.t('growth.percentile.value', {
    percentile: formatPercentile(strings.locale, percentile.percentile),
  });
}

/**
 * The growth section (EXP-4): a measurement table plus one trend chart per
 * measure the child actually has values for.
 *
 * Charts come before the table: a doctor reads the curve first and consults the
 * exact numbers second.
 */
export function buildGrowthSection({
  birthDate,
  measurements,
  references,
  strings,
}: GrowthSectionInput): ReportBlock[] {
  if (measurements.length === 0) {
    return [];
  }

  const blocks: ReportBlock[] = [];

  for (const measure of REPORT_GROWTH_MEASURES) {
    const block = buildGrowthChartBlock({
      measure,
      measurements,
      reference: references[measure] ?? null,
      strings,
    });
    if (block) {
      blocks.push(block);
    }
  }

  // One row per measurement with every measure side by side, rather than three
  // separate tables: a measurement is normally taken as one visit, and a doctor
  // compares weight against length on the same line.
  const columns = [
    strings.t('common.date'),
    strings.t('common.age'),
    ...REPORT_GROWTH_MEASURES.flatMap((measure) => [
      strings.t(REPORT_GROWTH_MEASURE_DEFINITIONS[measure].columnKey),
      strings.t('growth.column.percentile'),
    ]),
  ];

  const rows = measurements.map((measurement) => {
    const cells = [
      formatReportDate(strings.locale, measurement.measuredAt),
      formatAge(strings, birthDate, measurement.measuredAt),
    ];

    for (const measure of REPORT_GROWTH_MEASURES) {
      const definition = REPORT_GROWTH_MEASURE_DEFINITIONS[measure];
      const value = measurement[definition.valueField];
      cells.push(
        value === null ? strings.t('common.none') : definition.formatValue(strings.locale, value),
        value === null
          ? strings.t('common.none')
          : percentileCell(strings, measurement.percentiles[definition.percentileSlot]),
      );
    }

    return cells;
  });

  blocks.push({ kind: 'table', columns, rows });

  return blocks;
}
