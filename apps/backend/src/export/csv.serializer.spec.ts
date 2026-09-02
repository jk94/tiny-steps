import { parse } from 'csv-parse/sync';
import { toCsv } from './csv.serializer';
import {
  RECORD_KIND_EVENT,
  RECORD_KIND_GROWTH_MEASUREMENT,
  type RawExportRow,
} from './export.service';

/**
 * The expected column order, in one place. The exact-string assertions below
 * are built from it rather than from a hand-counted comma sequence, so a
 * column added to `RawExportRow` shows up as one readable diff instead of an
 * off-by-one in a wall of commas.
 */
const COLUMNS = [
  'id',
  'recordKind',
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
  'weightGrams',
  'lengthMillimeters',
  'headCircumferenceMillimeters',
  'lengthMeasurementPosition',
  'weightPercentile',
  'lengthPercentile',
  'headCircumferencePercentile',
  'note',
  'createdAt',
  'updatedAt',
] as const;

const HEADER = COLUMNS.join(',');

/** Renders one expected CSV line from a partial column -> raw-field map. */
function csvLine(fields: Partial<Record<(typeof COLUMNS)[number], string>>): string {
  return COLUMNS.map((column) => fields[column] ?? '').join(',');
}

function makeRow(overrides: Partial<RawExportRow> = {}): RawExportRow {
  return {
    id: 'e1',
    recordKind: RECORD_KIND_EVENT,
    childId: 'c1',
    userId: 'u1',
    type: 'DIAPER',
    occurredAt: '2026-01-01T07:00:00.000Z',
    startedAt: null,
    endedAt: null,
    durationSeconds: null,
    feedingType: null,
    side: null,
    amountMl: null,
    diaperType: 'BOTH',
    weightGrams: null,
    lengthMillimeters: null,
    headCircumferenceMillimeters: null,
    lengthMeasurementPosition: null,
    weightPercentile: null,
    lengthPercentile: null,
    headCircumferencePercentile: null,
    note: null,
    createdAt: '2026-01-01T07:00:00.000Z',
    updatedAt: '2026-01-01T07:00:00.000Z',
    ...overrides,
  };
}

describe('toCsv', () => {
  it('emits only the header row for an empty export', () => {
    expect(toCsv([])).toBe(`${HEADER}\n`);
  });

  it('renders null columns as empty fields and derived values verbatim', () => {
    const csv = toCsv([
      makeRow({
        id: 'sleep-1',
        type: 'SLEEP',
        startedAt: '2026-01-01T09:00:00.000Z',
        endedAt: '2026-01-01T10:00:00.000Z',
        durationSeconds: 3600,
        diaperType: null,
      }),
    ]);

    expect(csv).toBe(
      `${HEADER}\n` +
        csvLine({
          id: 'sleep-1',
          recordKind: RECORD_KIND_EVENT,
          childId: 'c1',
          userId: 'u1',
          type: 'SLEEP',
          occurredAt: '2026-01-01T07:00:00.000Z',
          startedAt: '2026-01-01T09:00:00.000Z',
          endedAt: '2026-01-01T10:00:00.000Z',
          durationSeconds: '3600',
          createdAt: '2026-01-01T07:00:00.000Z',
          updatedAt: '2026-01-01T07:00:00.000Z',
        }) +
        '\n',
    );
  });

  it('fills the growth columns for a measurement row and leaves the event columns blank', () => {
    const csv = toCsv([
      makeRow({
        id: 'growth-1',
        recordKind: RECORD_KIND_GROWTH_MEASUREMENT,
        type: 'GROWTH',
        diaperType: null,
        weightGrams: 12000,
        lengthMillimeters: 870,
        headCircumferenceMillimeters: 480,
        lengthMeasurementPosition: 'LYING',
        weightPercentile: 42,
        lengthPercentile: 55,
        headCircumferencePercentile: 61,
      }),
    ]);

    const records = parse(csv, { columns: true }) as Record<string, string>[];
    expect(records[0]).toMatchObject({
      recordKind: RECORD_KIND_GROWTH_MEASUREMENT,
      type: 'GROWTH',
      weightGrams: '12000',
      lengthMillimeters: '870',
      headCircumferenceMillimeters: '480',
      lengthMeasurementPosition: 'LYING',
      weightPercentile: '42',
      // Event-only columns stay blank rather than being omitted, so the header
      // keeps matching every row.
      feedingType: '',
      diaperType: '',
      durationSeconds: '',
    });
  });

  // This is the entire reason a CSV library is used rather than hand-rolling
  // string joins: a free-text note containing a comma, a double quote, AND a
  // newline must be RFC-4180 quoted (whole field wrapped in quotes, inner
  // quotes doubled, embedded newline preserved inside the quotes).
  it('RFC-4180-quotes a note containing a comma, a double quote, and a newline', () => {
    const note = 'spat up, a "lot"\nthen slept';

    const csv = toCsv([makeRow({ note })]);

    expect(csv).toBe(
      `${HEADER}\n` +
        csvLine({
          id: 'e1',
          recordKind: RECORD_KIND_EVENT,
          childId: 'c1',
          userId: 'u1',
          type: 'DIAPER',
          occurredAt: '2026-01-01T07:00:00.000Z',
          diaperType: 'BOTH',
          note: '"spat up, a ""lot""\nthen slept"',
          createdAt: '2026-01-01T07:00:00.000Z',
          updatedAt: '2026-01-01T07:00:00.000Z',
        }) +
        '\n',
    );

    // And it round-trips back to the original value through a CSV parser.
    const records = parse(csv, { columns: true }) as Record<string, string>[];
    expect(records).toHaveLength(1);
    expect(records[0].note).toBe(note);
  });
});
