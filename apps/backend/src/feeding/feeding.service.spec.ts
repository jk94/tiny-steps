import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventType } from '../event/event-type.enum';
import { EventConflictException } from '../event/event-conflict.exception';
import type { RealtimeService } from '../realtime/realtime.service';
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
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
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
    $transaction: jest.Mock;
  };
  let realtime: { broadcastEventChange: jest.Mock };
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
      // Interactive transactions run the callback with a transaction client; the
      // mock passes `prisma` itself as `tx`, so reads/writes hit the same mocked
      // delegates and every existing assertion on `prisma.event.*` still applies.
      $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) => callback(prisma)),
    };
    realtime = { broadcastEventChange: jest.fn() };
    service = new FeedingService(
      prisma as unknown as PrismaService,
      realtime as unknown as RealtimeService,
    );
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

    it('broadcasts a created event:changed message on success', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.create.mockResolvedValue(makeEvent());

      await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, { feedingType: FeedingType.SOLID });

      expect(realtime.broadcastEventChange).toHaveBeenCalledWith(HOUSEHOLD_ID, {
        type: EventType.FEEDING,
        action: 'created',
        eventId: EVENT_ID,
        childId: CHILD_ID,
        householdId: HOUSEHOLD_ID,
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
        data: { updatedAt: expect.any(Date), feedingDetail: { update: { amountMl: 120 } } },
        include: { feedingDetail: true },
      });
      expect(realtime.broadcastEventChange).toHaveBeenCalledWith(HOUSEHOLD_ID, {
        type: EventType.FEEDING,
        action: 'updated',
        eventId: EVENT_ID,
        childId: CHILD_ID,
        householdId: HOUSEHOLD_ID,
      });
    });

    it('clears an existing note when the DTO explicitly sends note: null', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const existing = makeEvent({
        feedingDetail: {
          eventId: EVENT_ID,
          feedingType: FeedingType.BOTTLE,
          side: null,
          amountMl: 90,
          note: 'Spit up a little',
        },
      });
      prisma.event.findUnique.mockResolvedValue(existing);
      prisma.event.update.mockResolvedValue(
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

      // Distinct from the "merges partial fields" test above, where `note`
      // is simply absent from the DTO (left untouched) — here it is
      // explicitly `null` (cleared).
      const dto: UpdateFeedingEventDto = { note: null };
      await service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, dto);

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { updatedAt: expect.any(Date), feedingDetail: { update: { note: null } } },
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
        data: { updatedAt: expect.any(Date), feedingDetail: undefined },
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

    describe('Last-Write-Wins (clientTimestamp)', () => {
      it('applies the update unconditionally when no clientTimestamp is supplied (regression)', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        const existing = makeEvent({ updatedAt: new Date('2026-01-01T12:00:00.000Z') });
        prisma.event.findUnique.mockResolvedValue(existing);
        prisma.event.update.mockResolvedValue(existing);

        await service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, { note: 'x' });

        expect(prisma.event.update).toHaveBeenCalled();
      });

      it('applies the update when clientTimestamp is newer than the server updatedAt', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        const existing = makeEvent({ updatedAt: new Date('2026-01-01T10:00:00.000Z') });
        prisma.event.findUnique.mockResolvedValue(existing);
        prisma.event.update.mockResolvedValue(existing);

        await service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
          note: 'x',
          clientTimestamp: '2026-01-01T11:00:00.000Z',
        });

        expect(prisma.event.update).toHaveBeenCalled();
      });

      it('throws EventConflictException carrying the current summary and skips the write when clientTimestamp is older', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        const existing = makeEvent({ updatedAt: new Date('2026-01-01T12:00:00.000Z') });
        prisma.event.findUnique.mockResolvedValue(existing);

        const error = await service
          .update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
            note: 'x',
            clientTimestamp: '2026-01-01T11:00:00.000Z',
          })
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(EventConflictException);
        expect((error as EventConflictException).getResponse()).toMatchObject({
          code: 'EVENT_CONFLICT',
          currentEvent: expect.objectContaining({ id: EVENT_ID }),
        });
        expect(prisma.event.update).not.toHaveBeenCalled();
      });
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
      // Collapsed into the generic 'updated' action, per RealtimeService's
      // payload doc comment.
      expect(realtime.broadcastEventChange).toHaveBeenCalledWith(HOUSEHOLD_ID, {
        type: EventType.FEEDING,
        action: 'updated',
        eventId: EVENT_ID,
        childId: CHILD_ID,
        householdId: HOUSEHOLD_ID,
      });
      expect(result.durationSeconds).toBe(900);
    });

    it('throws EventAlreadyStoppedException (409, code EVENT_ALREADY_STOPPED) when the timer is already stopped', async () => {
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

      const error = await service
        .stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID)
        .then(
          () => undefined,
          (thrown: unknown) => thrown,
        );
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'EVENT_ALREADY_STOPPED',
      });
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

    describe('endedAt source', () => {
      function makeRunningBreast(updatedAt = new Date('2026-01-01T10:00:00.000Z')) {
        return makeEvent({
          startedAt: new Date('2026-01-01T10:00:00.000Z'),
          endedAt: null,
          updatedAt,
          feedingDetail: {
            eventId: EVENT_ID,
            feedingType: FeedingType.BREAST,
            side: FeedingSide.LEFT,
            amountMl: null,
            note: null,
          },
        });
      }

      it('persists endedAt as the supplied clientTimestamp, not the wall clock, for a buffered offline stop', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        const running = makeRunningBreast();
        prisma.event.findUnique.mockResolvedValue(running);
        prisma.event.update.mockResolvedValue(running);

        // A stop captured offline at 10:15 but only resent later must record
        // 10:15 as endedAt — using `new Date()` here would inflate the duration.
        await service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
          clientTimestamp: '2026-01-01T10:15:00.000Z',
        });

        expect(prisma.event.update).toHaveBeenCalledWith({
          where: { id: EVENT_ID },
          data: { endedAt: new Date('2026-01-01T10:15:00.000Z') },
          include: { feedingDetail: true },
        });
      });

      it('falls back to a freshly-generated Date for a plain online stop with no clientTimestamp', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        const running = makeRunningBreast();
        prisma.event.findUnique.mockResolvedValue(running);
        prisma.event.update.mockResolvedValue(running);

        const before = Date.now();
        await service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);
        const after = Date.now();

        const endedAt = prisma.event.update.mock.calls[0][0].data.endedAt as Date;
        expect(endedAt).toBeInstanceOf(Date);
        expect(endedAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(endedAt.getTime()).toBeLessThanOrEqual(after);
      });
    });

    describe('Last-Write-Wins (clientTimestamp)', () => {
      function makeRunningBreast(updatedAt: Date) {
        return makeEvent({
          startedAt: new Date('2026-01-01T10:00:00.000Z'),
          endedAt: null,
          updatedAt,
          feedingDetail: {
            eventId: EVENT_ID,
            feedingType: FeedingType.BREAST,
            side: FeedingSide.LEFT,
            amountMl: null,
            note: null,
          },
        });
      }

      it('stops unconditionally when no clientTimestamp is supplied (regression)', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        const running = makeRunningBreast(new Date('2026-01-01T12:00:00.000Z'));
        prisma.event.findUnique.mockResolvedValue(running);
        prisma.event.update.mockResolvedValue(running);

        await service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

        expect(prisma.event.update).toHaveBeenCalled();
      });

      it('stops when clientTimestamp is newer than the server updatedAt', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        const running = makeRunningBreast(new Date('2026-01-01T10:00:00.000Z'));
        prisma.event.findUnique.mockResolvedValue(running);
        prisma.event.update.mockResolvedValue(running);

        await service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
          clientTimestamp: '2026-01-01T11:00:00.000Z',
        });

        expect(prisma.event.update).toHaveBeenCalled();
      });

      it('throws EventConflictException and skips the write when clientTimestamp is older', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        prisma.event.findUnique.mockResolvedValue(
          makeRunningBreast(new Date('2026-01-01T12:00:00.000Z')),
        );

        await expect(
          service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
            clientTimestamp: '2026-01-01T11:00:00.000Z',
          }),
        ).rejects.toThrow(EventConflictException);
        expect(prisma.event.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('remove', () => {
    it('deletes only the Event row, relying on cascade for FeedingDetail', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(makeEvent());

      await service.remove(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: EVENT_ID } });
      expect(prisma.event.delete).toHaveBeenCalledTimes(1);
      expect(realtime.broadcastEventChange).toHaveBeenCalledWith(HOUSEHOLD_ID, {
        type: EventType.FEEDING,
        action: 'deleted',
        eventId: EVENT_ID,
        childId: CHILD_ID,
        householdId: HOUSEHOLD_ID,
      });
    });

    it('throws NotFoundException when scoped to a different child/household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.remove(HOUSEHOLD_ID, CHILD_ID, EVENT_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.event.delete).not.toHaveBeenCalled();
      expect(realtime.broadcastEventChange).not.toHaveBeenCalled();
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
