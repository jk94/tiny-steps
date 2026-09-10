import type { HealthRecordSummary } from '../../../health-record/health-record.service';
import type { ReportBlock } from '../report-document.types';
import { formatReportDate, formatReportDateTime, formatReportNumber } from '../report-i18n/format';
import type { ReportStrings } from '../report-i18n/report-i18n';

export interface MedicalSectionInput {
  /** Records with an `administeredAt` — already windowed to the period. */
  administered: HealthRecordSummary[];
  /**
   * Records still planned. Deliberately **not** windowed — see the section
   * builder's doc comment.
   */
  planned: HealthRecordSummary[];
  strings: ReportStrings;
}

function kindCell(strings: ReportStrings, record: HealthRecordSummary): string {
  return strings.t(`medical.kind.${record.kind}` as 'medical.kind.MEDICATION');
}

function doseCell(strings: ReportStrings, record: HealthRecordSummary): string {
  // MED-3 guarantees a dose never exists without its unit, so the pair is
  // either fully present or fully absent.
  if (record.doseAmount === null || record.doseUnit === null) {
    return strings.t('common.none');
  }
  return strings.t('medical.dose.value', {
    amount: formatReportNumber(strings.locale, record.doseAmount),
    unit: record.doseUnit,
  });
}

/**
 * The medications/vaccinations section (EXP-6).
 *
 * Two tables, and the asymmetry between them is the requirement rather than an
 * oversight: what was **given** is windowed to the reporting period, but what
 * is still **planned** is listed in full regardless of the period. A parent
 * takes this document to an appointment precisely to discuss the vaccination
 * that is due next month — clipping it to the period would hide exactly the
 * rows the visit is about.
 */
export function buildMedicalSection({
  administered,
  planned,
  strings,
}: MedicalSectionInput): ReportBlock[] {
  const blocks: ReportBlock[] = [];

  if (administered.length > 0) {
    blocks.push({
      kind: 'table',
      caption: strings.t('medical.done.caption'),
      columns: [
        strings.t('medical.column.administeredAt'),
        strings.t('medical.column.kind'),
        strings.t('medical.column.name'),
        strings.t('medical.column.dose'),
        strings.t('medical.column.batch'),
      ],
      rows: [...administered]
        .sort((a, b) => (a.administeredAt ?? '').localeCompare(b.administeredAt ?? ''))
        .map((record) => [
          // A real instant, unlike every other date in the report — a dose
          // given at 07:00 and one at 19:00 are clinically different.
          record.administeredAt
            ? formatReportDateTime(strings.locale, record.administeredAt)
            : strings.t('common.none'),
          kindCell(strings, record),
          record.name,
          doseCell(strings, record),
          record.vaccineBatch ?? strings.t('common.none'),
        ]),
    });
  }

  if (planned.length > 0) {
    blocks.push({
      kind: 'table',
      caption: strings.t('medical.planned.caption'),
      columns: [
        strings.t('medical.column.dueAt'),
        strings.t('medical.column.kind'),
        strings.t('medical.column.name'),
        strings.t('medical.column.dose'),
      ],
      rows: [...planned]
        .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
        .map((record) => [
          record.dueAt ? formatReportDate(strings.locale, record.dueAt) : strings.t('common.none'),
          kindCell(strings, record),
          record.name,
          doseCell(strings, record),
        ]),
    });
  }

  return blocks;
}
