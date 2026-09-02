import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedingType } from '../feeding/feeding-type.enum';
import { FeedingSide } from '../feeding/feeding-side.enum';
import { DiaperType } from '../diaper/diaper-type.enum';
import { EventType } from '../event/event-type.enum';
import { ChildSex } from '../child/child-sex.enum';
import { LengthMeasurementPosition } from '../growth/length-measurement-position.enum';
import { MilestoneCategory } from '../milestone/milestone-category.enum';
import { MilestoneTemplate } from '../milestone/milestone-template.enum';
import {
  ExportService,
  GROWTH_EXPORT_TYPE,
  MILESTONE_EXPORT_TYPE,
  RECORD_KIND_EVENT,
  RECORD_KIND_GROWTH_MEASUREMENT,
  RECORD_KIND_MILESTONE,
} from './export.service';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';
const USER_ID = 'user-1';
const FROM = new Date('2026-01-01T00:00:00.000Z');
const TO = new Date('2026-01-02T00:00:00.000Z');

function makeChild(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: CHILD_ID,
    householdId: HOUSEHOLD_ID,
    name: 'Alex',
    birthDate: new Date('2024-01-01T00:00:00.000Z'),
    photoPath: null,
    photoMimeType: null,
    sex: ChildSex.MALE as string | null,
    createdAt: new Date('2024-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

/** Empty domain columns, spread into every expected event row. */
const NO_GROWTH_COLUMNS = {
  recordKind: RECORD_KIND_EVENT,
  weightGrams: null,
  lengthMillimeters: null,
  headCircumferenceMillimeters: null,
  lengthMeasurementPosition: null,
  weightPercentile: null,
  lengthPercentile: null,
  headCircumferencePercentile: null,
  weightZScore: null,
  lengthZScore: null,
  headCircumferenceZScore: null,
  milestoneTemplateKey: null,
  milestoneTitle: null,
  milestoneCategory: null,
  milestonePhotoCount: null,
};

function makeMilestone(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'milestone-1',
    childId: CHILD_ID,
    userId: USER_ID,
    templateKey: MilestoneTemplate.FIRST_STEPS as string | null,
    title: 'Erste Schritte',
    category: MilestoneCategory.MOTOR as string | null,
    achievedAt: new Date('2026-01-01T08:45:00.000Z'),
    note: 'Im Wohnzimmer',
    createdAt: new Date('2026-01-01T18:00:00.000Z'),
    updatedAt: new Date('2026-01-01T18:00:00.000Z'),
    _count: { photos: 3 },
    ...overrides,
  };
}

function makeGrowthMeasurement(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'growth-1',
    childId: CHILD_ID,
    userId: USER_ID,
    // 731 completed days after the 2024-01-01 birth date.
    measuredAt: new Date('2026-01-01T08:30:00.000Z'),
    weightGrams: 12000,
    lengthMillimeters: 870,
    headCircumferenceMillimeters: 480,
    lengthMeasurementPosition: null as string | null,
    note: 'U7 check-up',
    createdAt: new Date('2026-01-01T08:30:00.000Z'),
    updatedAt: new Date('2026-01-01T08:30:00.000Z'),
    ...overrides,
  };
}

function makeFeedingEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'feeding-1',
    childId: CHILD_ID,
    userId: USER_ID,
    type: EventType.FEEDING,
    occurredAt: new Date('2026-01-01T08:00:00.000Z'),
    startedAt: new Date('2026-01-01T08:00:00.000Z'),
    endedAt: new Date('2026-01-01T08:15:00.000Z'),
    createdAt: new Date('2026-01-01T08:00:00.000Z'),
    updatedAt: new Date('2026-01-01T08:16:00.000Z'),
    feedingDetail: {
      eventId: 'feeding-1',
      feedingType: FeedingType.BREAST,
      side: FeedingSide.LEFT,
      amountMl: null,
      note: 'good latch',
    },
    diaperDetail: null,
    ...overrides,
  };
}

function makeSleepEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sleep-1',
    childId: CHILD_ID,
    userId: USER_ID,
    type: EventType.SLEEP,
    occurredAt: new Date('2026-01-01T09:00:00.000Z'),
    startedAt: new Date('2026-01-01T09:00:00.000Z'),
    endedAt: new Date('2026-01-01T10:00:00.000Z'),
    createdAt: new Date('2026-01-01T09:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    feedingDetail: null,
    diaperDetail: null,
    ...overrides,
  };
}

function makeDiaperEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'diaper-1',
    childId: CHILD_ID,
    userId: USER_ID,
    type: EventType.DIAPER,
    occurredAt: new Date('2026-01-01T07:00:00.000Z'),
    startedAt: null,
    endedAt: null,
    createdAt: new Date('2026-01-01T07:00:00.000Z'),
    updatedAt: new Date('2026-01-01T07:00:00.000Z'),
    feedingDetail: null,
    diaperDetail: {
      eventId: 'diaper-1',
      diaperType: DiaperType.BOTH,
      ...NO_GROWTH_COLUMNS,
      note: 'soft',
    },
    ...overrides,
  };
}

describe('ExportService', () => {
  let prisma: {
    child: { findUnique: jest.Mock };
    event: { findMany: jest.Mock };
    growthMeasurement: { findMany: jest.Mock };
    milestone: { findMany: jest.Mock };
  };
  let service: ExportService;

  beforeEach(() => {
    prisma = {
      child: { findUnique: jest.fn() },
      event: { findMany: jest.fn().mockResolvedValue([]) },
      growthMeasurement: { findMany: jest.fn().mockResolvedValue([]) },
      milestone: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new ExportService(prisma as unknown as PrismaService);
  });

  it('throws NotFoundException when the child is not in the given household', async () => {
    prisma.child.findUnique.mockResolvedValue(null);

    await expect(service.getRawEvents(HOUSEHOLD_ID, CHILD_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty array when the child has no events', async () => {
    prisma.child.findUnique.mockResolvedValue(makeChild());
    prisma.event.findMany.mockResolvedValue([]);

    await expect(service.getRawEvents(HOUSEHOLD_ID, CHILD_ID)).resolves.toEqual([]);
  });

  it('omits the occurredAt filter when no from/to are given (full history)', async () => {
    prisma.child.findUnique.mockResolvedValue(makeChild());
    prisma.event.findMany.mockResolvedValue([]);

    await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { childId: CHILD_ID },
      include: { feedingDetail: true, diaperDetail: true },
      orderBy: { occurredAt: 'asc' },
    });
    expect(prisma.growthMeasurement.findMany).toHaveBeenCalledWith({
      where: { childId: CHILD_ID },
      orderBy: { measuredAt: 'asc' },
    });
    expect(prisma.milestone.findMany).toHaveBeenCalledWith({
      where: { childId: CHILD_ID },
      include: { _count: { select: { photos: true } } },
      orderBy: { achievedAt: 'asc' },
    });
  });

  it('applies the [from, to) filter when both from and to are given', async () => {
    prisma.child.findUnique.mockResolvedValue(makeChild());
    prisma.event.findMany.mockResolvedValue([]);

    await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID, FROM, TO);

    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { childId: CHILD_ID, occurredAt: { gte: FROM, lt: TO } },
      include: { feedingDetail: true, diaperDetail: true },
      orderBy: { occurredAt: 'asc' },
    });
    // The same window applies to `measuredAt`, the growth equivalent of
    // `occurredAt`.
    expect(prisma.growthMeasurement.findMany).toHaveBeenCalledWith({
      where: { childId: CHILD_ID, measuredAt: { gte: FROM, lt: TO } },
      orderBy: { measuredAt: 'asc' },
    });
    // And to `achievedAt`, the milestone equivalent.
    expect(prisma.milestone.findMany).toHaveBeenCalledWith({
      where: { childId: CHILD_ID, achievedAt: { gte: FROM, lt: TO } },
      include: { _count: { select: { photos: true } } },
      orderBy: { achievedAt: 'asc' },
    });
  });

  it('applies an open-ended upper bound when only from is given', async () => {
    prisma.child.findUnique.mockResolvedValue(makeChild());
    prisma.event.findMany.mockResolvedValue([]);

    await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID, FROM, undefined);

    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { childId: CHILD_ID, occurredAt: { gte: FROM } },
      include: { feedingDetail: true, diaperDetail: true },
      orderBy: { occurredAt: 'asc' },
    });
    expect(prisma.growthMeasurement.findMany).toHaveBeenCalledWith({
      where: { childId: CHILD_ID, measuredAt: { gte: FROM } },
      orderBy: { measuredAt: 'asc' },
    });
    expect(prisma.milestone.findMany).toHaveBeenCalledWith({
      where: { childId: CHILD_ID, achievedAt: { gte: FROM } },
      include: { _count: { select: { photos: true } } },
      orderBy: { achievedAt: 'asc' },
    });
  });

  it('applies an open-ended lower bound when only to is given', async () => {
    prisma.child.findUnique.mockResolvedValue(makeChild());
    prisma.event.findMany.mockResolvedValue([]);

    await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID, undefined, TO);

    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: { childId: CHILD_ID, occurredAt: { lt: TO } },
      include: { feedingDetail: true, diaperDetail: true },
      orderBy: { occurredAt: 'asc' },
    });
    expect(prisma.growthMeasurement.findMany).toHaveBeenCalledWith({
      where: { childId: CHILD_ID, measuredAt: { lt: TO } },
      orderBy: { measuredAt: 'asc' },
    });
    expect(prisma.milestone.findMany).toHaveBeenCalledWith({
      where: { childId: CHILD_ID, achievedAt: { lt: TO } },
      include: { _count: { select: { photos: true } } },
      orderBy: { achievedAt: 'asc' },
    });
  });

  it('flattens a FEEDING event with its detail fields and derived duration', async () => {
    prisma.child.findUnique.mockResolvedValue(makeChild());
    prisma.event.findMany.mockResolvedValue([makeFeedingEvent()]);

    const [row] = await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

    expect(row).toEqual({
      id: 'feeding-1',
      childId: CHILD_ID,
      userId: USER_ID,
      type: EventType.FEEDING,
      occurredAt: '2026-01-01T08:00:00.000Z',
      startedAt: '2026-01-01T08:00:00.000Z',
      endedAt: '2026-01-01T08:15:00.000Z',
      durationSeconds: 900,
      feedingType: FeedingType.BREAST,
      side: FeedingSide.LEFT,
      amountMl: null,
      diaperType: null,
      note: 'good latch',
      createdAt: '2026-01-01T08:00:00.000Z',
      updatedAt: '2026-01-01T08:16:00.000Z',
      ...NO_GROWTH_COLUMNS,
    });
  });

  it('flattens a SLEEP event (no detail table) with null type-specific columns', async () => {
    prisma.child.findUnique.mockResolvedValue(makeChild());
    prisma.event.findMany.mockResolvedValue([makeSleepEvent()]);

    const [row] = await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

    expect(row).toEqual({
      id: 'sleep-1',
      childId: CHILD_ID,
      userId: USER_ID,
      type: EventType.SLEEP,
      occurredAt: '2026-01-01T09:00:00.000Z',
      startedAt: '2026-01-01T09:00:00.000Z',
      endedAt: '2026-01-01T10:00:00.000Z',
      durationSeconds: 3600,
      feedingType: null,
      side: null,
      amountMl: null,
      diaperType: null,
      note: null,
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
      ...NO_GROWTH_COLUMNS,
    });
  });

  it('flattens a DIAPER event (point event) with null timer columns and its note', async () => {
    prisma.child.findUnique.mockResolvedValue(makeChild());
    prisma.event.findMany.mockResolvedValue([makeDiaperEvent()]);

    const [row] = await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

    expect(row).toEqual({
      id: 'diaper-1',
      childId: CHILD_ID,
      userId: USER_ID,
      type: EventType.DIAPER,
      occurredAt: '2026-01-01T07:00:00.000Z',
      startedAt: null,
      endedAt: null,
      durationSeconds: null,
      feedingType: null,
      side: null,
      amountMl: null,
      diaperType: DiaperType.BOTH,
      note: 'soft',
      createdAt: '2026-01-01T07:00:00.000Z',
      updatedAt: '2026-01-01T07:00:00.000Z',
      ...NO_GROWTH_COLUMNS,
    });
  });

  it('flattens a mixed result in chronological order, each row mapped to its type', async () => {
    prisma.child.findUnique.mockResolvedValue(makeChild());
    prisma.event.findMany.mockResolvedValue([
      makeDiaperEvent(),
      makeFeedingEvent(),
      makeSleepEvent(),
    ]);

    const rows = await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

    expect(rows.map((row) => row.type)).toEqual([
      EventType.DIAPER,
      EventType.FEEDING,
      EventType.SLEEP,
    ]);
    expect(rows[0].diaperType).toBe(DiaperType.BOTH);
    expect(rows[1].feedingType).toBe(FeedingType.BREAST);
    expect(rows[2].durationSeconds).toBe(3600);
  });

  describe('growth measurements', () => {
    it('flattens a measurement with its values, method and computed percentiles', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.findMany.mockResolvedValue([makeGrowthMeasurement()]);

      const [row] = await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

      expect(row).toMatchObject({
        id: 'growth-1',
        recordKind: RECORD_KIND_GROWTH_MEASUREMENT,
        childId: CHILD_ID,
        userId: USER_ID,
        type: GROWTH_EXPORT_TYPE,
        // `measuredAt` fills the shared occurredAt column.
        occurredAt: '2026-01-01T08:30:00.000Z',
        startedAt: null,
        endedAt: null,
        durationSeconds: null,
        feedingType: null,
        side: null,
        amountMl: null,
        diaperType: null,
        weightGrams: 12000,
        lengthMillimeters: 870,
        headCircumferenceMillimeters: 480,
        lengthMeasurementPosition: null,
        note: 'U7 check-up',
      });
      expect(row.weightPercentile).toBeGreaterThan(0);
      expect(row.weightPercentile).toBeLessThan(100);
      expect(row.lengthPercentile).not.toBeNull();
      expect(row.headCircumferencePercentile).not.toBeNull();
    });

    it('rounds the percentile to whole numbers and the z-score to two decimals', () => {
      // The exported percentile must read the same as the one on screen, and
      // the z-score is only useful at the precision it is quoted with.
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.findMany.mockResolvedValue([makeGrowthMeasurement()]);

      return service.getRawEvents(HOUSEHOLD_ID, CHILD_ID).then(([row]) => {
        expect(row.weightPercentile).toBe(Math.round(row.weightPercentile as number));
        expect(row.weightZScore).toBeCloseTo(
          Math.round((row.weightZScore as number) * 100) / 100,
          10,
        );
      });
    });

    it('exports the z-score alongside the percentile (W-9)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.findMany.mockResolvedValue([makeGrowthMeasurement()]);

      const [row] = await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

      expect(typeof row.weightZScore).toBe('number');
      expect(typeof row.lengthZScore).toBe('number');
      expect(typeof row.headCircumferenceZScore).toBe('number');
    });

    it('carries the stored measurement-method override', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.findMany.mockResolvedValue([
        makeGrowthMeasurement({ lengthMeasurementPosition: LengthMeasurementPosition.LYING }),
      ]);

      const [row] = await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

      expect(row.lengthMeasurementPosition).toBe(LengthMeasurementPosition.LYING);
    });

    it('leaves the percentile columns empty when the child has no sex (W-10)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild({ sex: null }));
      prisma.growthMeasurement.findMany.mockResolvedValue([makeGrowthMeasurement()]);

      const [row] = await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

      expect(row.weightGrams).toBe(12000);
      expect(row.weightPercentile).toBeNull();
      expect(row.lengthPercentile).toBeNull();
      expect(row.headCircumferencePercentile).toBeNull();
      expect(row.weightZScore).toBeNull();
    });

    it('leaves the percentile column of an absent value empty', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.growthMeasurement.findMany.mockResolvedValue([
        makeGrowthMeasurement({ lengthMillimeters: null, headCircumferenceMillimeters: null }),
      ]);

      const [row] = await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

      expect(row.lengthPercentile).toBeNull();
      expect(row.headCircumferencePercentile).toBeNull();
      expect(row.weightPercentile).not.toBeNull();
    });

    it('merges events and measurements into one chronologically sorted list', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findMany.mockResolvedValue([makeDiaperEvent(), makeSleepEvent()]);
      prisma.growthMeasurement.findMany.mockResolvedValue([makeGrowthMeasurement()]);

      const rows = await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

      // Diaper 07:00, growth 08:30, sleep 09:00.
      expect(rows.map((row) => row.id)).toEqual(['diaper-1', 'growth-1', 'sleep-1']);
      expect(rows.map((row) => row.recordKind)).toEqual([
        RECORD_KIND_EVENT,
        RECORD_KIND_GROWTH_MEASUREMENT,
        RECORD_KIND_EVENT,
      ]);
    });
  });

  describe('milestones', () => {
    it('flattens a milestone with its frozen title, category and photo count', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findMany.mockResolvedValue([makeMilestone()]);

      const [row] = await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

      expect(row).toEqual({
        id: 'milestone-1',
        recordKind: RECORD_KIND_MILESTONE,
        childId: CHILD_ID,
        userId: USER_ID,
        type: MILESTONE_EXPORT_TYPE,
        // `achievedAt` fills the shared occurredAt column.
        occurredAt: '2026-01-01T08:45:00.000Z',
        startedAt: null,
        endedAt: null,
        durationSeconds: null,
        feedingType: null,
        side: null,
        amountMl: null,
        diaperType: null,
        note: 'Im Wohnzimmer',
        createdAt: '2026-01-01T18:00:00.000Z',
        updatedAt: '2026-01-01T18:00:00.000Z',
        weightGrams: null,
        lengthMillimeters: null,
        headCircumferenceMillimeters: null,
        lengthMeasurementPosition: null,
        weightPercentile: null,
        lengthPercentile: null,
        headCircumferencePercentile: null,
        weightZScore: null,
        lengthZScore: null,
        headCircumferenceZScore: null,
        milestoneTemplateKey: MilestoneTemplate.FIRST_STEPS,
        milestoneTitle: 'Erste Schritte',
        milestoneCategory: MilestoneCategory.MOTOR,
        milestonePhotoCount: 3,
      });
    });

    it('exports a free entry with no template key and no category', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.milestone.findMany.mockResolvedValue([
        makeMilestone({
          templateKey: null,
          category: null,
          title: 'Erste Zugfahrt',
          _count: { photos: 0 },
        }),
      ]);

      const [row] = await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

      expect(row).toMatchObject({
        milestoneTemplateKey: null,
        milestoneCategory: null,
        milestoneTitle: 'Erste Zugfahrt',
        milestonePhotoCount: 0,
      });
    });

    it('merges events, measurements and milestones into one chronological list', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findMany.mockResolvedValue([makeDiaperEvent(), makeSleepEvent()]);
      prisma.growthMeasurement.findMany.mockResolvedValue([makeGrowthMeasurement()]);
      prisma.milestone.findMany.mockResolvedValue([makeMilestone()]);

      const rows = await service.getRawEvents(HOUSEHOLD_ID, CHILD_ID);

      // Diaper 07:00, growth 08:30, milestone 08:45, sleep 09:00.
      expect(rows.map((row) => row.id)).toEqual(['diaper-1', 'growth-1', 'milestone-1', 'sleep-1']);
      expect(rows.map((row) => row.recordKind)).toEqual([
        RECORD_KIND_EVENT,
        RECORD_KIND_GROWTH_MEASUREMENT,
        RECORD_KIND_MILESTONE,
        RECORD_KIND_EVENT,
      ]);
    });
  });
});
