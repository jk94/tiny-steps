import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { EventType } from '../event/event-type.enum';
import { DiaperType } from '../diaper/diaper-type.enum';
import { ExportController } from './export.controller';
import { ExportQueryDto } from './dto/export-query.dto';
import { ExportService, RawExportRow } from './export.service';
import { toCsv } from './csv.serializer';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';

const rows: RawExportRow[] = [
  {
    id: 'diaper-1',
    childId: CHILD_ID,
    userId: 'user-1',
    type: EventType.DIAPER,
    occurredAt: '2026-01-01T07:00:00.000Z',
    startedAt: null,
    endedAt: null,
    durationSeconds: null,
    feedingType: null,
    side: null,
    amountMl: null,
    diaperType: DiaperType.PEE,
    note: null,
    createdAt: '2026-01-01T07:00:00.000Z',
    updatedAt: '2026-01-01T07:00:00.000Z',
  },
];

function makeResponse(): { res: Response; set: jest.Mock } {
  const set = jest.fn();
  const res = { set } as unknown as Response;
  return { res, set };
}

async function readStreamable(file: StreamableFile): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of file.getStream()) {
    chunks.push(Buffer.from(chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf8');
}

describe('ExportController', () => {
  let exportService: jest.Mocked<Pick<ExportService, 'getRawEvents'>>;
  let controller: ExportController;

  beforeEach(() => {
    exportService = { getRawEvents: jest.fn().mockResolvedValue(rows) };
    controller = new ExportController(exportService as unknown as ExportService);
  });

  describe('exportJson', () => {
    it('delegates to getRawEvents with parsed from/to dates and sets JSON download headers', async () => {
      const { res, set } = makeResponse();
      const query: ExportQueryDto = {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
      };

      const result = await controller.exportJson(HOUSEHOLD_ID, CHILD_ID, query, res);

      expect(exportService.getRawEvents).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        new Date(query.from!),
        new Date(query.to!),
      );
      expect(set).toHaveBeenCalledWith({
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="export-${CHILD_ID}.json"`,
      });
      expect(result).toBeInstanceOf(StreamableFile);
      expect(JSON.parse(await readStreamable(result))).toEqual(rows);
    });

    it('passes undefined dates through when from/to are omitted', async () => {
      const { res } = makeResponse();

      await controller.exportJson(HOUSEHOLD_ID, CHILD_ID, {}, res);

      expect(exportService.getRawEvents).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        undefined,
        undefined,
      );
    });
  });

  describe('exportCsv', () => {
    it('delegates to getRawEvents and sets CSV download headers with the serialized body', async () => {
      const { res, set } = makeResponse();

      const result = await controller.exportCsv(HOUSEHOLD_ID, CHILD_ID, {}, res);

      expect(exportService.getRawEvents).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        undefined,
        undefined,
      );
      expect(set).toHaveBeenCalledWith({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="export-${CHILD_ID}.csv"`,
      });
      expect(await readStreamable(result)).toBe(toCsv(rows));
    });
  });
});
