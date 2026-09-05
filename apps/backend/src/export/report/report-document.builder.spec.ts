import type { Child } from '@prisma/client';
import type { EventService, PeriodTrackingSummary } from '../../event/event.service';
import type { GrowthMeasurementSummary, GrowthService } from '../../growth/growth.service';
import type { HealthRecordService } from '../../health-record/health-record.service';
import type { MilestoneService } from '../../milestone/milestone.service';
import { ReportDocumentBuilder } from './report-document.builder';
import type { ReportBlock, ReportDocument, ReportSection } from './report-document.types';

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

const FROM = new Date('2026-06-01T00:00:00.000Z');
const TO = new Date('2026-09-01T00:00:00.000Z');
const CREATED_AT = new Date('2026-09-03T10:00:00.000Z');

function measurement(overrides: Partial<GrowthMeasurementSummary> = {}): GrowthMeasurementSummary {
  return {
    id: 'measurement-1',
    childId: CHILD.id,
    userId: 'user-1',
    measuredAt: new Date('2026-06-15T00:00:00.000Z'),
    ageInDaysAtMeasurement: 471,
    weightGrams: 10200,
    lengthMillimeters: 790,
    headCircumferenceMillimeters: 460,
    lengthMeasurementPosition: null,
    effectiveLengthMeasurementPosition: 'LYING',
    lengthOrHeightReferenceUsed: 'LENGTH',
    note: null,
    createdAt: new Date('2026-06-15T00:00:00.000Z'),
    updatedAt: new Date('2026-06-15T00:00:00.000Z'),
    percentiles: {
      weight: { status: 'COMPUTED', zScore: 0.12, percentile: 54.8 },
      length: { status: 'UNAVAILABLE', reason: 'CHILD_SEX_NOT_SET' },
      headCircumference: null,
    },
    ...overrides,
  };
}

const EMPTY_TRACKING: PeriodTrackingSummary = {
  days: 92,
  feedingCount: 0,
  diaperCount: 0,
  sleepHours: 0,
  feedingsPerDay: 0,
  diapersPerDay: 0,
  sleepHoursPerDay: 0,
};

interface Mocks {
  growth: jest.Mocked<Pick<GrowthService, 'list' | 'getReference'>>;
  milestones: jest.Mocked<Pick<MilestoneService, 'list'>>;
  health: jest.Mocked<Pick<HealthRecordService, 'list'>>;
  events: jest.Mocked<Pick<EventService, 'getPeriodTrackingSummary'>>;
}

function createMocks(): Mocks {
  return {
    growth: {
      list: jest.fn().mockResolvedValue([]),
      getReference: jest.fn().mockResolvedValue({
        indicator: 'WEIGHT_FOR_AGE',
        sex: null,
        available: false,
        reason: 'CHILD_SEX_NOT_SET',
      }),
    },
    milestones: { list: jest.fn().mockResolvedValue([]) },
    health: { list: jest.fn().mockResolvedValue([]) },
    events: { getPeriodTrackingSummary: jest.fn().mockResolvedValue(EMPTY_TRACKING) },
  };
}

function createBuilder(mocks: Mocks): ReportDocumentBuilder {
  return new ReportDocumentBuilder(
    mocks.growth as unknown as GrowthService,
    mocks.milestones as unknown as MilestoneService,
    mocks.health as unknown as HealthRecordService,
    mocks.events as unknown as EventService,
  );
}

function build(
  mocks: Mocks,
  sections: ReportSection[],
  locale: 'de' | 'en' = 'de',
): Promise<ReportDocument> {
  return createBuilder(mocks).build({
    householdId: CHILD.householdId,
    child: CHILD,
    from: FROM,
    to: TO,
    sections,
    locale,
    createdAt: CREATED_AT,
  });
}

function kinds(document: ReportDocument): ReportBlock['kind'][] {
  return document.blocks.map((block) => block.kind);
}

describe('ReportDocumentBuilder', () => {
  describe('section selection', () => {
    it('emits only the document header for CORE alone', async () => {
      const mocks = createMocks();

      const document = await build(mocks, ['CORE']);

      expect(kinds(document)).toEqual(['documentHeader']);
      expect(mocks.growth.list).not.toHaveBeenCalled();
      expect(mocks.milestones.list).not.toHaveBeenCalled();
      expect(mocks.health.list).not.toHaveBeenCalled();
      expect(mocks.events.getPeriodTrackingSummary).not.toHaveBeenCalled();
    });

    it('emits a heading, the charts and the table for GROWTH', async () => {
      const mocks = createMocks();
      mocks.growth.list.mockResolvedValue([measurement()]);

      const document = await build(mocks, ['GROWTH']);

      // One chart per measure that carries a value, then the combined table.
      expect(kinds(document)).toEqual(['sectionHeading', 'chart', 'chart', 'chart', 'table']);
    });

    it('renders sections in a fixed order regardless of the requested order', async () => {
      const mocks = createMocks();

      const document = await build(mocks, ['TRACKING', 'MEDICAL', 'CORE', 'MILESTONES', 'GROWTH']);

      const headings = document.blocks
        .filter((block) => block.kind === 'sectionHeading')
        .map((block) => block.text);
      expect(headings).toEqual([
        'Wachstum',
        'Meilensteine',
        'Medikamente & Impfungen',
        'Alltags-Tracking',
      ]);
      expect(document.blocks[0].kind).toBe('documentHeader');
    });

    it('adds an explicit note for a selected section that has no data', async () => {
      const mocks = createMocks();

      const document = await build(mocks, ['MILESTONES']);

      expect(kinds(document)).toEqual(['sectionHeading', 'emptySectionNote']);
      expect(document.blocks[1]).toMatchObject({ text: 'Keine Daten in diesem Zeitraum.' });
    });
  });

  describe('document header', () => {
    it('states the child, birth date, age, period and creation date', async () => {
      const mocks = createMocks();

      const document = await build(mocks, ['CORE']);

      expect(document.blocks[0]).toEqual({
        kind: 'documentHeader',
        childName: 'Mila',
        birthDate: '01.03.2025',
        ageAtReport: '1 Jahr, 6 Monate',
        periodFrom: '01.06.2026',
        // Inclusive last day, not the exclusive `to` bound.
        periodTo: '31.08.2026',
        createdAt: '03.09.2026',
      });
    });

    it('localizes the whole document when English is requested', async () => {
      const mocks = createMocks();
      mocks.milestones.list.mockResolvedValue([]);

      const document = await build(mocks, ['CORE', 'MILESTONES'], 'en');

      expect(document.locale).toBe('en');
      expect(document.title).toBe('Report for Mila');
      expect(document.blocks[0]).toMatchObject({
        birthDate: '03/01/2025',
        ageAtReport: '1 year, 6 months',
      });
      expect(document.blocks[1]).toMatchObject({ text: 'Milestones' });
      expect(document.blocks[2]).toMatchObject({ text: 'No data in this period.' });
    });
  });

  describe('growth section', () => {
    it('takes the percentile from the summary rather than recomputing it', async () => {
      const mocks = createMocks();
      mocks.growth.list.mockResolvedValue([measurement()]);

      const document = await build(mocks, ['GROWTH']);
      const table = document.blocks.find((block) => block.kind === 'table')!;

      // 54.8 rounds to 55; the length percentile is UNAVAILABLE (W-10/W-11)
      // and must read as an em dash, never as a guessed number.
      expect(table.rows[0]).toEqual([
        '15.06.2026',
        '1 Jahr, 3 Monate',
        '10,2',
        'P55',
        '79,0',
        '—',
        '46,0',
        '—',
      ]);
    });

    it('does not fetch the WHO bands when there is nothing to plot', async () => {
      const mocks = createMocks();

      await build(mocks, ['GROWTH']);

      expect(mocks.growth.getReference).not.toHaveBeenCalled();
    });
  });

  describe('medical section', () => {
    it('windows administered records to the period but never the planned ones', async () => {
      const mocks = createMocks();
      mocks.health.list.mockImplementation((_household, _child, query) =>
        Promise.resolve(
          query?.status === 'done'
            ? [
                healthRecord({
                  id: 'in',
                  name: 'Vitamin D',
                  administeredAt: '2026-07-01T08:00:00.000Z',
                }),
                healthRecord({
                  id: 'out',
                  name: 'Ibuprofen',
                  administeredAt: '2026-01-04T08:00:00.000Z',
                }),
              ]
            : [
                healthRecord({
                  id: 'far-future',
                  name: 'Masern-Impfung',
                  administeredAt: null,
                  dueAt: '2027-05-01T00:00:00.000Z',
                }),
              ],
        ),
      );

      const document = await build(mocks, ['MEDICAL']);
      const tables = document.blocks.filter((block) => block.kind === 'table');

      expect(tables).toHaveLength(2);
      expect(tables[0].rows.map((row) => row[2])).toEqual(['Vitamin D']);
      // Due in 2027, long after the period ends — and still listed (EXP-6).
      expect(tables[1].rows.map((row) => row[2])).toEqual(['Masern-Impfung']);
    });
  });

  describe('tracking section', () => {
    it('reports the per-day averages the event service computed', async () => {
      const mocks = createMocks();
      mocks.events.getPeriodTrackingSummary.mockResolvedValue({
        days: 92,
        feedingCount: 552,
        diaperCount: 460,
        sleepHours: 1104,
        feedingsPerDay: 6,
        diapersPerDay: 5,
        sleepHoursPerDay: 12,
      });

      const document = await build(mocks, ['TRACKING']);
      const figures = document.blocks.find((block) => block.kind === 'keyFigures')!;

      expect(figures.figures).toEqual([
        { label: 'Fütterungen/Tag', value: '6,0' },
        { label: 'Schlaf/Tag (Std.)', value: '12,0' },
        { label: 'Windeln/Tag', value: '5,0' },
      ]);
      expect(document.blocks.find((block) => block.kind === 'bodyText')).toMatchObject({
        text: 'Durchschnitt pro Tag über 92 Tage',
      });
    });

    it('reports "no data" instead of three zeroes for a period with no events', async () => {
      const mocks = createMocks();

      const document = await build(mocks, ['TRACKING']);

      expect(kinds(document)).toEqual(['sectionHeading', 'emptySectionNote']);
    });
  });
});

function healthRecord(overrides: Record<string, unknown>) {
  return {
    id: 'health-1',
    childId: CHILD.id,
    userId: 'user-1',
    kind: 'VACCINATION' as const,
    name: 'Impfung',
    administeredAt: null,
    dueAt: null,
    doseAmount: null,
    doseUnit: null,
    vaccineBatch: null,
    note: null,
    reminderEnabled: false,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}
