import { parse } from 'csv-parse/sync';
import { toCsv } from './csv.serializer';
import { RawExportRow } from './export.service';

const HEADER =
  'id,childId,userId,type,occurredAt,startedAt,endedAt,durationSeconds,feedingType,side,amountMl,diaperType,note,createdAt,updatedAt';

function makeRow(overrides: Partial<RawExportRow> = {}): RawExportRow {
  return {
    id: 'e1',
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
        'sleep-1,c1,u1,SLEEP,2026-01-01T07:00:00.000Z,2026-01-01T09:00:00.000Z,' +
        '2026-01-01T10:00:00.000Z,3600,,,,,,2026-01-01T07:00:00.000Z,2026-01-01T07:00:00.000Z\n',
    );
  });

  // This is the entire reason a CSV library is used rather than hand-rolling
  // string joins: a free-text note containing a comma, a double quote, AND a
  // newline must be RFC-4180 quoted (whole field wrapped in quotes, inner
  // quotes doubled, embedded newline preserved inside the quotes).
  it('RFC-4180-quotes a note containing a comma, a double quote, and a newline', () => {
    const note = 'spat up, a "lot"\nthen slept';

    const csv = toCsv([makeRow({ note })]);

    const expectedField = '"spat up, a ""lot""\nthen slept"';
    expect(csv).toBe(
      `${HEADER}\n` +
        `e1,c1,u1,DIAPER,2026-01-01T07:00:00.000Z,,,,,,,BOTH,${expectedField},` +
        '2026-01-01T07:00:00.000Z,2026-01-01T07:00:00.000Z\n',
    );

    // And it round-trips back to the original value through a CSV parser.
    const records = parse(csv, { columns: true }) as Record<string, string>[];
    expect(records).toHaveLength(1);
    expect(records[0].note).toBe(note);
  });
});
