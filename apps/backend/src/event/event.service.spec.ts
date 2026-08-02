import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedingType } from '../feeding/feeding-type.enum';
import { DiaperType } from '../diaper/diaper-type.enum';
import { EventService } from './event.service';
import { EventType } from './event-type.enum';

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
    startedAt: null,
    endedAt: null,
    createdAt: new Date('2026-01-01T08:00:00.000Z'),
    feedingDetail: {
      eventId: 'feeding-1',
      feedingType: FeedingType.SOLID,
      side: null,
      amountMl: null,
      note: null,
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
    feedingDetail: null,
    diaperDetail: {
      eventId: 'diaper-1',
      diaperType: DiaperType.PEE,
      note: null,
    },
    ...overrides,
  };
}

describe('EventService', () => {
  let prisma: {
    child: { findUnique: jest.Mock };
    event: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
    };
  };
  let service: EventService;

  beforeEach(() => {
    prisma = {
      child: { findUnique: jest.fn() },
      event: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new EventService(prisma as unknown as PrismaService);
  });

  describe('listDaily', () => {
    it('throws NotFoundException when the child is not in the given household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.listDaily(HOUSEHOLD_ID, CHILD_ID, FROM, TO)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.event.findMany).not.toHaveBeenCalled();
    });

    it('returns an empty array for a day with no events', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findMany.mockResolvedValue([]);

      const result = await service.listDaily(HOUSEHOLD_ID, CHILD_ID, FROM, TO);

      expect(result).toEqual([]);
    });

    it('queries within the [from, to) range scoped to the child', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findMany.mockResolvedValue([]);

      await service.listDaily(HOUSEHOLD_ID, CHILD_ID, FROM, TO);

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { childId: CHILD_ID, occurredAt: { gte: FROM, lt: TO } },
        include: { feedingDetail: true, diaperDetail: true },
        orderBy: { occurredAt: 'asc' },
      });
    });

    it('merges & sorts all three event types ascending by occurredAt, mapped to their own summary shape', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      // Deliberately returned already-ascending (as Prisma's orderBy would),
      // to prove each row is mapped to its correct per-type summary rather
      // than re-sorting here in JS.
      prisma.event.findMany.mockResolvedValue([
        makeDiaperEvent(),
        makeFeedingEvent(),
        makeSleepEvent(),
      ]);

      const result = await service.listDaily(HOUSEHOLD_ID, CHILD_ID, FROM, TO);

      expect(result.map((event) => event.type)).toEqual([
        EventType.DIAPER,
        EventType.FEEDING,
        EventType.SLEEP,
      ]);
      expect(result[0]).toMatchObject({ type: EventType.DIAPER, diaperType: DiaperType.PEE });
      expect(result[1]).toMatchObject({ type: EventType.FEEDING, feedingType: FeedingType.SOLID });
      expect(result[2]).toMatchObject({ type: EventType.SLEEP, durationSeconds: 3600 });
    });
  });

  describe('getStatsSummary', () => {
    it('throws NotFoundException when the child is not in the given household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(
        service.getStatsSummary(HOUSEHOLD_ID, CHILD_ID, FROM, TO),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns zeroed stats and null lastEventAt when there are no events at all', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.count.mockResolvedValue(0);
      prisma.event.findMany.mockResolvedValue([]);
      prisma.event.findFirst.mockResolvedValue(null);

      const result = await service.getStatsSummary(HOUSEHOLD_ID, CHILD_ID, FROM, TO);

      expect(result).toEqual({
        sleepHoursToday: 0,
        feedingCountToday: 0,
        lastEventAt: { FEEDING: null, SLEEP: null, DIAPER: null },
      });
    });

    it('computes feedingCountToday via a scoped count query, independent of sleep/diaper data', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.count.mockResolvedValue(3);
      prisma.event.findMany.mockResolvedValue([]);
      prisma.event.findFirst.mockResolvedValue(null);

      const result = await service.getStatsSummary(HOUSEHOLD_ID, CHILD_ID, FROM, TO);

      expect(prisma.event.count).toHaveBeenCalledWith({
        where: { childId: CHILD_ID, type: EventType.FEEDING, occurredAt: { gte: FROM, lt: TO } },
      });
      expect(result.feedingCountToday).toBe(3);
      expect(result.sleepHoursToday).toBe(0);
    });

    it('sums finished sleep sessions into sleepHoursToday, rounded to 1 decimal', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.count.mockResolvedValue(0);
      prisma.event.findMany.mockResolvedValue([
        makeSleepEvent({
          startedAt: new Date('2026-01-01T01:00:00.000Z'),
          endedAt: new Date('2026-01-01T02:30:00.000Z'),
        }),
        makeSleepEvent({
          id: 'sleep-2',
          startedAt: new Date('2026-01-01T10:00:00.000Z'),
          endedAt: new Date('2026-01-01T10:50:00.000Z'),
        }),
      ]);
      prisma.event.findFirst.mockResolvedValue(null);

      const result = await service.getStatsSummary(HOUSEHOLD_ID, CHILD_ID, FROM, TO);

      // 1.5h + 50min (0.8333...h) = 2.3333...h -> rounded to 2.3
      expect(result.sleepHoursToday).toBe(2.3);
    });

    it('excludes an ongoing/unfinished sleep timer from the sum without throwing', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.count.mockResolvedValue(0);
      prisma.event.findMany.mockResolvedValue([
        makeSleepEvent({
          startedAt: new Date('2026-01-01T01:00:00.000Z'),
          endedAt: new Date('2026-01-01T02:00:00.000Z'),
        }),
        makeSleepEvent({
          id: 'sleep-ongoing',
          startedAt: new Date('2026-01-01T11:00:00.000Z'),
          endedAt: null,
        }),
      ]);
      prisma.event.findFirst.mockResolvedValue(null);

      const result = await service.getStatsSummary(HOUSEHOLD_ID, CHILD_ID, FROM, TO);

      // Only the finished 1h session counts — the ongoing one is excluded.
      expect(result.sleepHoursToday).toBe(1);
    });

    it('reports lastEventAt as the most recent event ever, even outside the requested from/to range', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.count.mockResolvedValue(0);
      prisma.event.findMany.mockResolvedValue([]);
      const outsideRangeFeeding = new Date('2025-06-15T12:00:00.000Z');
      const outsideRangeSleep = new Date('2025-06-14T08:00:00.000Z');
      prisma.event.findFirst.mockImplementation(({ where }: { where: { type: string } }) => {
        if (where.type === EventType.FEEDING) {
          return Promise.resolve({ ...makeFeedingEvent(), occurredAt: outsideRangeFeeding });
        }
        if (where.type === EventType.SLEEP) {
          return Promise.resolve({ ...makeSleepEvent(), occurredAt: outsideRangeSleep });
        }
        return Promise.resolve(null);
      });

      const result = await service.getStatsSummary(HOUSEHOLD_ID, CHILD_ID, FROM, TO);

      expect(result.lastEventAt.FEEDING).toEqual(outsideRangeFeeding);
      expect(result.lastEventAt.SLEEP).toEqual(outsideRangeSleep);
      expect(result.lastEventAt.DIAPER).toBeNull();
      // Proves the findFirst calls for lastEventAt are NOT filtered by
      // from/to — only childId + type.
      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        where: { childId: CHILD_ID, type: EventType.FEEDING },
        orderBy: { occurredAt: 'desc' },
      });
    });

    it('returns null lastEventAt for a type with zero events ever', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.count.mockResolvedValue(0);
      prisma.event.findMany.mockResolvedValue([]);
      prisma.event.findFirst.mockResolvedValue(null);

      const result = await service.getStatsSummary(HOUSEHOLD_ID, CHILD_ID, FROM, TO);

      expect(result.lastEventAt).toEqual({ FEEDING: null, SLEEP: null, DIAPER: null });
    });
  });
});
