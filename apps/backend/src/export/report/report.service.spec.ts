import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Child } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MAX_REPORT_PERIOD_DAYS, ReportQueryDto } from '../dto/report-query.dto';
import { ReportDocumentBuilder } from './report-document.builder';
import type { ReportDocument } from './report-document.types';
import type { ReportRenderer } from './renderers/report-renderer.interface';
import { REPORT_EMPTY_PERIOD, ReportService } from './report.service';

const CHILD: Child = {
  id: 'child-1',
  householdId: 'household-1',
  name: 'Mila',
  birthDate: new Date('2025-03-01T00:00:00.000Z'),
  photoPath: null,
  photoMimeType: null,
  sex: 'FEMALE',
  createdAt: new Date('2025-03-01T00:00:00.000Z'),
};

const HEADER_BLOCK = {
  kind: 'documentHeader' as const,
  childName: 'Mila',
  birthDate: '01.03.2025',
  ageAtReport: '1 Jahr, 6 Monate',
  periodFrom: '01.06.2026',
  periodTo: '31.08.2026',
  createdAt: '03.09.2026',
};

function query(overrides: Partial<ReportQueryDto> = {}): ReportQueryDto {
  return Object.assign(new ReportQueryDto(), {
    from: '2026-06-01T00:00:00.000Z',
    to: '2026-09-01T00:00:00.000Z',
    locale: 'de' as const,
    sections: ['CORE', 'GROWTH', 'MILESTONES', 'MEDICAL', 'TRACKING'] as const,
    ...overrides,
  });
}

function createService(document: ReportDocument, childFound = true) {
  const prisma = {
    child: { findUnique: jest.fn().mockResolvedValue(childFound ? CHILD : null) },
  } as unknown as PrismaService;
  const builder = {
    build: jest.fn().mockResolvedValue(document),
  } as unknown as ReportDocumentBuilder;
  const renderer: jest.Mocked<ReportRenderer> = {
    render: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7 stub', 'latin1')),
  };

  return { service: new ReportService(prisma, builder, renderer), prisma, builder, renderer };
}

describe('ReportService.generatePdf', () => {
  it('renders a PDF for a period that has data', async () => {
    const { service, renderer, builder } = createService({
      locale: 'de',
      title: 'Bericht für Mila',
      blocks: [
        HEADER_BLOCK,
        { kind: 'sectionHeading', text: 'Wachstum' },
        { kind: 'table', columns: ['Datum'], rows: [['15.06.2026']] },
      ],
    });

    const buffer = await service.generatePdf('household-1', 'child-1', query());

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(builder.build).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: 'household-1',
        child: CHILD,
        from: new Date('2026-06-01T00:00:00.000Z'),
        to: new Date('2026-09-01T00:00:00.000Z'),
        locale: 'de',
      }),
    );
  });

  it('still renders when only some sections are empty', async () => {
    const { service, renderer } = createService({
      locale: 'de',
      title: 'Bericht für Mila',
      blocks: [
        HEADER_BLOCK,
        { kind: 'sectionHeading', text: 'Wachstum' },
        { kind: 'table', columns: ['Datum'], rows: [['15.06.2026']] },
        { kind: 'sectionHeading', text: 'Meilensteine' },
        { kind: 'emptySectionNote', text: 'Keine Daten in diesem Zeitraum.' },
      ],
    });

    await expect(service.generatePdf('household-1', 'child-1', query())).resolves.toBeInstanceOf(
      Buffer,
    );
    expect(renderer.render).toHaveBeenCalled();
  });

  it('rejects a period with nothing in it rather than returning an empty PDF', async () => {
    const { service, renderer } = createService({
      locale: 'de',
      title: 'Bericht für Mila',
      blocks: [
        HEADER_BLOCK,
        { kind: 'sectionHeading', text: 'Wachstum' },
        { kind: 'emptySectionNote', text: 'Keine Daten in diesem Zeitraum.' },
        { kind: 'sectionHeading', text: 'Meilensteine' },
        { kind: 'emptySectionNote', text: 'Keine Daten in diesem Zeitraum.' },
      ],
    });

    await expect(service.generatePdf('household-1', 'child-1', query())).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(renderer.render).not.toHaveBeenCalled();

    await expect(
      service.generatePdf('household-1', 'child-1', query()).catch((error) => error.getResponse()),
    ).resolves.toEqual({ code: REPORT_EMPTY_PERIOD });
  });

  it('hides a child from another household behind a 404', async () => {
    const { service } = createService(
      { locale: 'de', title: 'x', blocks: [HEADER_BLOCK] },
      /* childFound */ false,
    );

    await expect(service.generatePdf('household-1', 'foreign-child', query())).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('period validation', () => {
    it('rejects a period whose end is not after its start', async () => {
      const { service, builder } = createService({ locale: 'de', title: 'x', blocks: [] });

      await expect(
        service.generatePdf(
          'household-1',
          'child-1',
          query({ from: '2026-09-01T00:00:00.000Z', to: '2026-06-01T00:00:00.000Z' }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(builder.build).not.toHaveBeenCalled();
    });

    it(`rejects a period longer than ${MAX_REPORT_PERIOD_DAYS} days (EXP-15)`, async () => {
      const { service, builder } = createService({ locale: 'de', title: 'x', blocks: [] });

      await expect(
        service.generatePdf(
          'household-1',
          'child-1',
          query({ from: '2020-01-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' }),
        ),
      ).rejects.toThrow(/must not exceed/);
      expect(builder.build).not.toHaveBeenCalled();
    });

    it('accepts a period exactly at the cap', async () => {
      const { service } = createService({
        locale: 'de',
        title: 'x',
        blocks: [HEADER_BLOCK, { kind: 'bodyText', text: 'something' }],
      });
      const from = new Date('2024-01-01T00:00:00.000Z');
      const to = new Date(from.getTime() + MAX_REPORT_PERIOD_DAYS * 24 * 60 * 60 * 1000);

      await expect(
        service.generatePdf(
          'household-1',
          'child-1',
          query({ from: from.toISOString(), to: to.toISOString() }),
        ),
      ).resolves.toBeInstanceOf(Buffer);
    });
  });
});
