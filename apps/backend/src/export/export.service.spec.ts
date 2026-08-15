import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedingType } from '../feeding/feeding-type.enum';
import { FeedingSide } from '../feeding/feeding-side.enum';
import { DiaperType } from '../diaper/diaper-type.enum';
import { EventType } from '../event/event-type.enum';
import { ExportService } from './export.service';

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
    createdAt: new Date('2024-01-02T00:00:00.000Z'),
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
      note: 'soft',
    },
    ...overrides,
  };
}

describe('ExportService', () => {
  let prisma: {
    child: { findUnique: jest.Mock };
    event: { findMany: jest.Mock };
  };
  let service: ExportService;

  beforeEach(() => {
    prisma = {
      child: { findUnique: jest.fn() },
      event: { findMany: jest.fn() },
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
    });
  });

  it('flattens a mixed result preserving Prisma order, each row mapped to its type', async () => {
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
});
