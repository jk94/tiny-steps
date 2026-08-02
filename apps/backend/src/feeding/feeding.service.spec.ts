import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventType } from '../event/event-type.enum';
import { CreateFeedingEventDto } from './dto/create-feeding-event.dto';
import { UpdateFeedingEventDto } from './dto/update-feeding-event.dto';
import { FeedingService } from './feeding.service';
import { FeedingSide } from './feeding-side.enum';
import { FeedingType } from './feeding-type.enum';

const HOUSEHOLD_ID = 'household-1';
const CHILD_ID = 'child-1';
const USER_ID = 'user-1';
const EVENT_ID = 'event-1';

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

function makeEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: EVENT_ID,
    childId: CHILD_ID,
    userId: USER_ID,
    type: EventType.FEEDING,
    occurredAt: new Date('2026-01-01T10:00:00.000Z'),
    startedAt: null,
    endedAt: null,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    feedingDetail: {
      eventId: EVENT_ID,
      feedingType: FeedingType.SOLID,
      side: null,
      amountMl: null,
      note: null,
    },
    ...overrides,
  };
}

describe('FeedingService', () => {
  let prisma: {
    child: { findUnique: jest.Mock };
    event: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: FeedingService;

  beforeEach(() => {
    prisma = {
      child: { findUnique: jest.fn() },
      event: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new FeedingService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('throws NotFoundException when the child is not in the household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(
        service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, { feedingType: FeedingType.SOLID }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('creates a BREAST feed with explicit startedAt/endedAt (backfill), skipping the timer-conflict check', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const dto: CreateFeedingEventDto = {
        feedingType: FeedingType.BREAST,
        side: FeedingSide.LEFT,
        startedAt: '2026-01-01T10:00:00.000Z',
        endedAt: '2026-01-01T10:15:00.000Z',
      };
      prisma.event.create.mockResolvedValue(
        makeEvent({
          startedAt: new Date('2026-01-01T10:00:00.000Z'),
          endedAt: new Date('2026-01-01T10:15:00.000Z'),
          occurredAt: new Date('2026-01-01T10:00:00.000Z'),
          feedingDetail: {
            eventId: EVENT_ID,
            feedingType: FeedingType.BREAST,
            side: FeedingSide.LEFT,
            amountMl: null,
            note: null,
          },
        }),
      );

      await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, dto);

      expect(prisma.event.findFirst).not.toHaveBeenCalled();
      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          childId: CHILD_ID,
          userId: USER_ID,
          type: EventType.FEEDING,
          startedAt: new Date('2026-01-01T10:00:00.000Z'),
          endedAt: new Date('2026-01-01T10:15:00.000Z'),
          occurredAt: new Date('2026-01-01T10:00:00.000Z'),
          feedingDetail: {
            create: expect.objectContaining({
              feedingType: FeedingType.BREAST,
              side: FeedingSide.LEFT,
            }),
          },
        }),
        include: { feedingDetail: true },
      });
    });

    it('creates a running BREAST timer defaulting startedAt to now when omitted', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findFirst.mockResolvedValue(null);
      prisma.event.create.mockResolvedValue(
        makeEvent({
          feedingDetail: {
            eventId: EVENT_ID,
            feedingType: FeedingType.BREAST,
            side: FeedingSide.RIGHT,
            amountMl: null,
            note: null,
          },
        }),
      );

      await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        feedingType: FeedingType.BREAST,
        side: FeedingSide.RIGHT,
      });

      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        where: {
          childId: CHILD_ID,
          type: EventType.FEEDING,
          endedAt: null,
          feedingDetail: { is: { feedingType: FeedingType.BREAST } },
        },
      });
      const createArgs = prisma.event.create.mock.calls[0][0];
      expect(createArgs.data.startedAt).toBeInstanceOf(Date);
      expect(createArgs.data.endedAt).toBeNull();
    });

    it('throws ConflictException (409) when a BREAST timer is already running for the child', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findFirst.mockResolvedValue(makeEvent({ endedAt: null }));

      await expect(
        service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
          feedingType: FeedingType.BREAST,
          side: FeedingSide.LEFT,
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException (400) when endedAt is before an explicit startedAt for a BREAST feed', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const dto: CreateFeedingEventDto = {
        feedingType: FeedingType.BREAST,
        side: FeedingSide.LEFT,
        startedAt: '2026-01-01T08:00:00.000Z',
        endedAt: '2026-01-01T06:00:00.000Z',
      };

      await expect(service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException (400) when startedAt is omitted and endedAt is before the effective startedAt derived from occurredAt for a BREAST feed', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const dto: CreateFeedingEventDto = {
        feedingType: FeedingType.BREAST,
        side: FeedingSide.LEFT,
        occurredAt: '2026-01-01T08:00:00.000Z',
        endedAt: '2026-01-01T06:00:00.000Z',
      };

      await expect(service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('creates a BOTTLE feed, persisting amountMl and discarding side', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.create.mockResolvedValue(
        makeEvent({
          feedingDetail: {
            eventId: EVENT_ID,
            feedingType: FeedingType.BOTTLE,
            side: null,
            amountMl: 90,
            note: null,
          },
        }),
      );

      await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        feedingType: FeedingType.BOTTLE,
        amountMl: 90,
        side: FeedingSide.LEFT, // irrelevant for BOTTLE, must be discarded
      });

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          startedAt: null,
          endedAt: null,
          feedingDetail: {
            create: {
              feedingType: FeedingType.BOTTLE,
              side: null,
              amountMl: 90,
              note: null,
            },
          },
        }),
        include: { feedingDetail: true },
      });
    });

    it('creates a SOLID feed with an optional note', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.create.mockResolvedValue(makeEvent());

      await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        feedingType: FeedingType.SOLID,
        note: 'Ate half a banana',
      });

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          feedingDetail: {
            create: {
              feedingType: FeedingType.SOLID,
              side: null,
              amountMl: null,
              note: 'Ate half a banana',
            },
          },
        }),
        include: { feedingDetail: true },
      });
    });
  });

  describe('list', () => {
    it('scopes by childId + type FEEDING, ordered occurredAt desc', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findMany.mockResolvedValue([makeEvent()]);

      const result = await service.list(HOUSEHOLD_ID, CHILD_ID);

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { childId: CHILD_ID, type: EventType.FEEDING },
        orderBy: { occurredAt: 'desc' },
        include: { feedingDetail: true },
      });
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException for a child in a different household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.list(HOUSEHOLD_ID, CHILD_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findActiveTimer', () => {
    it('returns the running BREAST timer when one exists', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const runningEvent = makeEvent({
        startedAt: new Date('2026-01-01T10:00:00.000Z'),
        endedAt: null,
        feedingDetail: {
          eventId: EVENT_ID,
          feedingType: FeedingType.BREAST,
          side: FeedingSide.LEFT,
          amountMl: null,
          note: null,
        },
      });
      prisma.event.findFirst.mockResolvedValue(runningEvent);

      const result = await service.findActiveTimer(HOUSEHOLD_ID, CHILD_ID);

      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        where: {
          childId: CHILD_ID,
          type: EventType.FEEDING,
          endedAt: null,
          feedingDetail: { is: { feedingType: FeedingType.BREAST } },
        },
        include: { feedingDetail: true },
      });
      expect(result?.id).toBe(EVENT_ID);
    });

    it('returns null when no timer is running', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findFirst.mockResolvedValue(null);

      const result = await service.findActiveTimer(HOUSEHOLD_ID, CHILD_ID);

      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('returns the mapped summary when found', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(makeEvent());

      const result = await service.findOne(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: { id: EVENT_ID, childId: CHILD_ID, type: EventType.FEEDING },
        include: { feedingDetail: true },
      });
      expect(result.id).toBe(EVENT_ID);
    });

    it('throws NotFoundException when the child is not in the household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.findOne(HOUSEHOLD_ID, CHILD_ID, EVENT_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.event.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no matching event exists (wrong child/household/type)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(null);

      await expect(service.findOne(HOUSEHOLD_ID, CHILD_ID, EVENT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('merges partial fields onto the existing row and persists them', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const existing = makeEvent({
        feedingDetail: {
          eventId: EVENT_ID,
          feedingType: FeedingType.BOTTLE,
          side: null,
          amountMl: 90,
          note: null,
        },
      });
      prisma.event.findUnique.mockResolvedValue(existing);
      prisma.event.update.mockResolvedValue(
        makeEvent({
          feedingDetail: {
            eventId: EVENT_ID,
            feedingType: FeedingType.BOTTLE,
            side: null,
            amountMl: 120,
            note: null,
          },
        }),
      );

      const dto: UpdateFeedingEventDto = { amountMl: 120 };
      await service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, dto);

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { feedingDetail: { update: { amountMl: 120 } } },
        include: { feedingDetail: true },
      });
    });

    it('discards side for a BOTTLE event even if the DTO includes it', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const existing = makeEvent({
        feedingDetail: {
          eventId: EVENT_ID,
          feedingType: FeedingType.BOTTLE,
          side: null,
          amountMl: 90,
          note: null,
        },
      });
      prisma.event.findUnique.mockResolvedValue(existing);
      prisma.event.update.mockResolvedValue(existing);

      await service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
        side: FeedingSide.LEFT,
      } as UpdateFeedingEventDto);

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { feedingDetail: undefined },
        include: { feedingDetail: true },
      });
    });

    it('re-checks endedAt >= startedAt against the merged existing row (400) when only endedAt is patched', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const existing = makeEvent({
        startedAt: new Date('2026-01-01T10:20:00.000Z'),
        endedAt: null,
        feedingDetail: {
          eventId: EVENT_ID,
          feedingType: FeedingType.BREAST,
          side: FeedingSide.LEFT,
          amountMl: null,
          note: null,
        },
      });
      prisma.event.findUnique.mockResolvedValue(existing);

      await expect(
        service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
          endedAt: '2026-01-01T10:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('re-checks endedAt >= startedAt against the merged existing row (400) when only startedAt is patched', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const existing = makeEvent({
        startedAt: new Date('2026-01-01T10:00:00.000Z'),
        endedAt: new Date('2026-01-01T10:10:00.000Z'),
        feedingDetail: {
          eventId: EVENT_ID,
          feedingType: FeedingType.BREAST,
          side: FeedingSide.LEFT,
          amountMl: null,
          note: null,
        },
      });
      prisma.event.findUnique.mockResolvedValue(existing);

      await expect(
        service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
          startedAt: '2026-01-01T10:30:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when scoped to a different child/household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, { note: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("does not accept feedingType (not part of UpdateFeedingEventDto's type)", () => {
      const dto: UpdateFeedingEventDto = {};
      // Type-level assertion: assigning `feedingType` to `dto` must be a
      // compile error — verified structurally since `UpdateFeedingEventDto`
      // simply has no such property.
      expect('feedingType' in dto).toBe(false);
    });
  });

  describe('stop', () => {
    it('sets endedAt to now for a running BREAST timer', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const running = makeEvent({
        startedAt: new Date('2026-01-01T10:00:00.000Z'),
        endedAt: null,
        feedingDetail: {
          eventId: EVENT_ID,
          feedingType: FeedingType.BREAST,
          side: FeedingSide.LEFT,
          amountMl: null,
          note: null,
        },
      });
      prisma.event.findUnique.mockResolvedValue(running);
      prisma.event.update.mockResolvedValue(
        makeEvent({
          startedAt: new Date('2026-01-01T10:00:00.000Z'),
          endedAt: new Date('2026-01-01T10:15:00.000Z'),
          feedingDetail: running.feedingDetail,
        }),
      );

      const result = await service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { endedAt: expect.any(Date) },
        include: { feedingDetail: true },
      });
      expect(result.durationSeconds).toBe(900);
    });

    it('throws ConflictException (409) when the timer is already stopped', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(
        makeEvent({
          startedAt: new Date('2026-01-01T10:00:00.000Z'),
          endedAt: new Date('2026-01-01T10:15:00.000Z'),
          feedingDetail: {
            eventId: EVENT_ID,
            feedingType: FeedingType.BREAST,
            side: FeedingSide.LEFT,
            amountMl: null,
            note: null,
          },
        }),
      );

      await expect(service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException (409) for a non-BREAST event', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(makeEvent());

      await expect(service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when scoped to a different child/household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes only the Event row, relying on cascade for FeedingDetail', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(makeEvent());

      await service.remove(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: EVENT_ID } });
      expect(prisma.event.delete).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when scoped to a different child/household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.remove(HOUSEHOLD_ID, CHILD_ID, EVENT_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.event.delete).not.toHaveBeenCalled();
    });
  });

  describe('toSummary / durationSeconds computation', () => {
    it('computes durationSeconds when both startedAt and endedAt are present', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(
        makeEvent({
          startedAt: new Date('2026-01-01T10:00:00.000Z'),
          endedAt: new Date('2026-01-01T10:12:30.000Z'),
          feedingDetail: {
            eventId: EVENT_ID,
            feedingType: FeedingType.BREAST,
            side: FeedingSide.RIGHT,
            amountMl: null,
            note: null,
          },
        }),
      );

      const result = await service.findOne(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(result.durationSeconds).toBe(750);
    });

    it('returns null durationSeconds when the timer is still running', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(
        makeEvent({
          startedAt: new Date('2026-01-01T10:00:00.000Z'),
          endedAt: null,
          feedingDetail: {
            eventId: EVENT_ID,
            feedingType: FeedingType.BREAST,
            side: FeedingSide.RIGHT,
            amountMl: null,
            note: null,
          },
        }),
      );

      const result = await service.findOne(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(result.durationSeconds).toBeNull();
    });

    it('returns null durationSeconds for a point event (no startedAt/endedAt)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(makeEvent());

      const result = await service.findOne(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(result.durationSeconds).toBeNull();
    });
  });
});
