import { stringify } from 'csv-stringify/sync';
import { RawExportRow } from './export.service';

/**
 * Fixed column order for the CSV export. Kept as an explicit list (rather
 * than deriving from the first row's keys) so the header is stable and
 * deterministic even for an empty export, and matches `RawExportRow` 1:1.
 */
const CSV_COLUMNS: (keyof RawExportRow)[] = [
  'id',
  'childId',
  'userId',
  'type',
  'occurredAt',
  'startedAt',
  'endedAt',
  'durationSeconds',
  'feedingType',
  'side',
  'amountMl',
  'diaperType',
  'note',
  'createdAt',
  'updatedAt',
  // Appended in Phase 7.1, strictly after the original columns: a consumer
  // that reads this CSV positionally keeps working, since nothing before this
  // point moved. Blank on every event row.
  'recordKind',
  'weightGrams',
  'lengthMillimeters',
  'headCircumferenceMillimeters',
  'lengthMeasurementPosition',
  'weightPercentile',
  'lengthPercentile',
  'headCircumferencePercentile',
  'weightZScore',
  'lengthZScore',
  'headCircumferenceZScore',
  // Appended in Phase 7.2, again strictly after everything before it — same
  // positional-stability rule as the Phase 7.1 block. Blank on every event and
  // growth row.
  'milestoneTemplateKey',
  'milestoneTitle',
  'milestoneCategory',
  'milestonePhotoCount',
  // Appended in Phase 7.3, again strictly last — same positional-stability
  // rule. Blank on every event, growth and milestone row. The free-text note
  // is not repeated here: it lives in the shared `note` column above.
  'healthRecordKind',
  'healthRecordName',
  'healthRecordAdministeredAt',
  'healthRecordDueAt',
  'healthRecordDoseAmount',
  'healthRecordDoseUnit',
  'healthRecordVaccineBatch',
];

/**
 * Serializes flattened export rows to an RFC-4180 CSV string. Delegates all
 * quoting/escaping to `csv-stringify` — the whole reason a library is used
 * rather than hand-rolling string concatenation is correct handling of
 * field values that themselves contain commas, double quotes, or newlines
 * (notably the free-text `note` column). Pure and HTTP-agnostic so it can be
 * unit-tested directly.
 */
export function toCsv(rows: RawExportRow[]): string {
  return stringify(rows, {
    header: true,
    columns: CSV_COLUMNS as string[],
  });
}
