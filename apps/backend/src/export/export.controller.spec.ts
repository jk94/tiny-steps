import { StreamableFile } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { Response } from 'express';
import { EventType } from '../event/event-type.enum';
import { DiaperType } from '../diaper/diaper-type.enum';
import { ExportController } from './export.controller';
import { ExportQueryDto } from './dto/export-query.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { ExportService, RawExportRow } from './export.service';
import { ReportService } from './report/report.service';
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
  let reportService: jest.Mocked<Pick<ReportService, 'generatePdf'>>;
  let controller: ExportController;

  beforeEach(() => {
    exportService = { getRawEvents: jest.fn().mockResolvedValue(rows) };
    reportService = {
      generatePdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7 stub', 'latin1')),
    };
    controller = new ExportController(
      exportService as unknown as ExportService,
      reportService as unknown as ReportService,
    );
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

  describe('exportReportPdf', () => {
    it('delegates to the report service and sets PDF download headers', async () => {
      const { res, set } = makeResponse();
      const query = plainToInstance(ReportQueryDto, {
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-09-01T00:00:00.000Z',
        locale: 'de',
      });

      const result = await controller.exportReportPdf(HOUSEHOLD_ID, CHILD_ID, query, res);

      expect(reportService.generatePdf).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, query);
      expect(set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${CHILD_ID}.pdf"`,
      });
      expect(result).toBeInstanceOf(StreamableFile);
    });
  });
});

/** Runs the DTO through the same transform+validate the global pipe applies. */
function validateReportQuery(raw: Record<string, unknown>): {
  dto: ReportQueryDto;
  errors: string[];
} {
  const dto = plainToInstance(ReportQueryDto, raw);
  const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).map(
    (error) => error.property,
  );
  return { dto, errors };
}

describe('ReportQueryDto', () => {
  const VALID = {
    from: '2026-06-01T00:00:00.000Z',
    to: '2026-09-01T00:00:00.000Z',
    locale: 'de',
  };

  it('accepts a minimal valid query and defaults to every section', () => {
    const { dto, errors } = validateReportQuery(VALID);

    expect(errors).toEqual([]);
    expect(dto.sections).toEqual(['CORE', 'GROWTH', 'MILESTONES', 'MEDICAL', 'TRACKING']);
  });

  it('requires the period — a report is always for a chosen span (EXP-1)', () => {
    expect(validateReportQuery({ locale: 'de' }).errors).toEqual(
      expect.arrayContaining(['from', 'to']),
    );
  });

  it('requires the language and never guesses it (EXP-8)', () => {
    expect(validateReportQuery({ ...VALID, locale: undefined }).errors).toContain('locale');
    expect(validateReportQuery({ ...VALID, locale: 'fr' }).errors).toContain('locale');
  });

  it('parses a comma-separated section list', () => {
    const { dto, errors } = validateReportQuery({ ...VALID, sections: 'CORE,GROWTH' });

    expect(errors).toEqual([]);
    expect(dto.sections).toEqual(['CORE', 'GROWTH']);
  });

  it('parses repeated section params', () => {
    const { dto, errors } = validateReportQuery({ ...VALID, sections: ['CORE', 'MEDICAL'] });

    expect(errors).toEqual([]);
    expect(dto.sections).toEqual(['CORE', 'MEDICAL']);
  });

  it('rejects an unknown section and an empty selection', () => {
    expect(validateReportQuery({ ...VALID, sections: 'CORE,PHOTOS' }).errors).toContain('sections');
    expect(validateReportQuery({ ...VALID, sections: '' }).errors).toContain('sections');
  });
});
