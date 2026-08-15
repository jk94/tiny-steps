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
