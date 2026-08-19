import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventType } from '../event/event-type.enum';
import { EventConflictException } from '../event/event-conflict.exception';
import type { RealtimeService } from '../realtime/realtime.service';
import { CreateSleepEventDto } from './dto/create-sleep-event.dto';
import { UpdateSleepEventDto } from './dto/update-sleep-event.dto';
import { SleepService } from './sleep.service';

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
    type: EventType.SLEEP,
    occurredAt: new Date('2026-01-01T10:00:00.000Z'),
    startedAt: new Date('2026-01-01T10:00:00.000Z'),
    endedAt: null,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('SleepService', () => {
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
  let service: SleepService;

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
    service = new SleepService(
      prisma as unknown as PrismaService,
      realtime as unknown as RealtimeService,
    );
  });

  describe('create', () => {
    it('throws NotFoundException when the child is not in the household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {})).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('creates a running timer defaulting startedAt to now when omitted, skipping the conflict check only when none is running', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findFirst.mockResolvedValue(null);
      prisma.event.create.mockResolvedValue(makeEvent());

      await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {});

      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        where: { childId: CHILD_ID, type: EventType.SLEEP, endedAt: null },
      });
      const createArgs = prisma.event.create.mock.calls[0][0];
      expect(createArgs.data.type).toBe(EventType.SLEEP);
      expect(createArgs.data.startedAt).toBeInstanceOf(Date);
      expect(createArgs.data.endedAt).toBeNull();
      expect(realtime.broadcastEventChange).toHaveBeenCalledWith(HOUSEHOLD_ID, {
        type: EventType.SLEEP,
        action: 'created',
        eventId: EVENT_ID,
        childId: CHILD_ID,
        householdId: HOUSEHOLD_ID,
      });
    });

    it('creates a backfilled entry with explicit startedAt/endedAt, skipping the timer-conflict check', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const dto: CreateSleepEventDto = {
        startedAt: '2026-01-01T20:00:00.000Z',
        endedAt: '2026-01-02T06:00:00.000Z',
      };
      prisma.event.create.mockResolvedValue(
        makeEvent({
          startedAt: new Date('2026-01-01T20:00:00.000Z'),
          endedAt: new Date('2026-01-02T06:00:00.000Z'),
          occurredAt: new Date('2026-01-01T20:00:00.000Z'),
        }),
      );

      await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, dto);

      expect(prisma.event.findFirst).not.toHaveBeenCalled();
      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          childId: CHILD_ID,
          userId: USER_ID,
          type: EventType.SLEEP,
          startedAt: new Date('2026-01-01T20:00:00.000Z'),
          endedAt: new Date('2026-01-02T06:00:00.000Z'),
          occurredAt: new Date('2026-01-01T20:00:00.000Z'),
        }),
      });
    });

    it('throws ConflictException (409) when a sleep timer is already running for the child', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findFirst.mockResolvedValue(makeEvent({ endedAt: null }));

      await expect(service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {})).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException (400) when endedAt is before an explicit startedAt', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const dto: CreateSleepEventDto = {
        startedAt: '2026-01-01T08:00:00.000Z',
        endedAt: '2026-01-01T06:00:00.000Z',
      };

      await expect(service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException (400) when startedAt is omitted and endedAt is before the effective startedAt derived from occurredAt', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const dto: CreateSleepEventDto = {
        occurredAt: '2026-01-01T08:00:00.000Z',
        endedAt: '2026-01-01T06:00:00.000Z',
      };

      await expect(service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.event.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('scopes by childId + type SLEEP, ordered occurredAt desc', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findMany.mockResolvedValue([makeEvent()]);

      const result = await service.list(HOUSEHOLD_ID, CHILD_ID);

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { childId: CHILD_ID, type: EventType.SLEEP },
        orderBy: { occurredAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException for a child in a different household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.list(HOUSEHOLD_ID, CHILD_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findActiveTimer', () => {
    it('returns the running timer when one exists', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const runningEvent = makeEvent({ endedAt: null });
      prisma.event.findFirst.mockResolvedValue(runningEvent);

      const result = await service.findActiveTimer(HOUSEHOLD_ID, CHILD_ID);

      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        where: { childId: CHILD_ID, type: EventType.SLEEP, endedAt: null },
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
        where: { id: EVENT_ID, childId: CHILD_ID, type: EventType.SLEEP },
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
        startedAt: new Date('2026-01-01T20:00:00.000Z'),
        endedAt: new Date('2026-01-02T06:00:00.000Z'),
      });
      prisma.event.findUnique.mockResolvedValue(existing);
      prisma.event.update.mockResolvedValue(
        makeEvent({
          startedAt: new Date('2026-01-01T20:00:00.000Z'),
          endedAt: new Date('2026-01-02T06:30:00.000Z'),
        }),
      );

      const dto: UpdateSleepEventDto = { endedAt: '2026-01-02T06:30:00.000Z' };
      await service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, dto);

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { endedAt: new Date('2026-01-02T06:30:00.000Z'), updatedAt: expect.any(Date) },
      });
      expect(realtime.broadcastEventChange).toHaveBeenCalledWith(HOUSEHOLD_ID, {
        type: EventType.SLEEP,
        action: 'updated',
        eventId: EVENT_ID,
        childId: CHILD_ID,
        householdId: HOUSEHOLD_ID,
      });
    });

    it('re-checks endedAt >= startedAt against the merged existing row (400) when only endedAt is patched', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const existing = makeEvent({
        startedAt: new Date('2026-01-01T20:20:00.000Z'),
        endedAt: null,
      });
      prisma.event.findUnique.mockResolvedValue(existing);

      await expect(
        service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
          endedAt: '2026-01-01T20:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('re-checks endedAt >= startedAt against the merged existing row (400) when only startedAt is patched', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const existing = makeEvent({
        startedAt: new Date('2026-01-01T20:00:00.000Z'),
        endedAt: new Date('2026-01-01T20:10:00.000Z'),
      });
      prisma.event.findUnique.mockResolvedValue(existing);

      await expect(
        service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
          startedAt: '2026-01-01T20:30:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when scoped to a different child/household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    describe('Last-Write-Wins (clientTimestamp)', () => {
      it('applies the update unconditionally when no clientTimestamp is supplied (regression)', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        const existing = makeEvent({ updatedAt: new Date('2026-01-01T12:00:00.000Z') });
        prisma.event.findUnique.mockResolvedValue(existing);
        prisma.event.update.mockResolvedValue(existing);

        await service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
          occurredAt: '2026-01-01T09:00:00.000Z',
        });

        expect(prisma.event.update).toHaveBeenCalled();
      });

      it('applies the update when clientTimestamp is newer than the server updatedAt', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        const existing = makeEvent({ updatedAt: new Date('2026-01-01T10:00:00.000Z') });
        prisma.event.findUnique.mockResolvedValue(existing);
        prisma.event.update.mockResolvedValue(existing);

        await service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
          occurredAt: '2026-01-01T09:00:00.000Z',
          clientTimestamp: '2026-01-01T11:00:00.000Z',
        });

        expect(prisma.event.update).toHaveBeenCalled();
      });

      it('throws EventConflictException and skips the write when clientTimestamp is older', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        prisma.event.findUnique.mockResolvedValue(
          makeEvent({ updatedAt: new Date('2026-01-01T12:00:00.000Z') }),
        );

        await expect(
          service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
            occurredAt: '2026-01-01T09:00:00.000Z',
            clientTimestamp: '2026-01-01T11:00:00.000Z',
          }),
        ).rejects.toThrow(EventConflictException);
        expect(prisma.event.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('stop', () => {
    it('sets endedAt to now for a running timer', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      const running = makeEvent({
        startedAt: new Date('2026-01-01T20:00:00.000Z'),
        endedAt: null,
      });
      prisma.event.findUnique.mockResolvedValue(running);
      prisma.event.update.mockResolvedValue(
        makeEvent({
          startedAt: new Date('2026-01-01T20:00:00.000Z'),
          endedAt: new Date('2026-01-01T20:15:00.000Z'),
        }),
      );

      const result = await service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { endedAt: expect.any(Date) },
      });
      // Collapsed into the generic 'updated' action, per RealtimeService's
      // payload doc comment.
      expect(realtime.broadcastEventChange).toHaveBeenCalledWith(HOUSEHOLD_ID, {
        type: EventType.SLEEP,
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
          startedAt: new Date('2026-01-01T20:00:00.000Z'),
          endedAt: new Date('2026-01-01T20:15:00.000Z'),
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

    it('throws NotFoundException when scoped to a different child/household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    describe('endedAt source', () => {
      it('persists endedAt as the supplied clientTimestamp, not the wall clock, for a buffered offline stop', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        const running = makeEvent({
          startedAt: new Date('2026-01-01T22:00:00.000Z'),
          endedAt: null,
          updatedAt: new Date('2026-01-01T22:00:00.000Z'),
        });
        prisma.event.findUnique.mockResolvedValue(running);
        prisma.event.update.mockResolvedValue(running);

        // A sleep-timer stop captured offline at 22:00 but resent hours later
        // must record 22:00 as endedAt — otherwise the night's sleep duration
        // is inflated by the whole offline gap (the core bug this fix closes).
        await service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
          clientTimestamp: '2026-01-01T22:00:00.000Z',
        });

        expect(prisma.event.update).toHaveBeenCalledWith({
          where: { id: EVENT_ID },
          data: { endedAt: new Date('2026-01-01T22:00:00.000Z') },
        });
      });

      it('falls back to a freshly-generated Date for a plain online stop with no clientTimestamp', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        const running = makeEvent({
          startedAt: new Date('2026-01-01T20:00:00.000Z'),
          endedAt: null,
        });
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
      it('stops when clientTimestamp is newer than the server updatedAt', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        const running = makeEvent({
          startedAt: new Date('2026-01-01T20:00:00.000Z'),
          endedAt: null,
          updatedAt: new Date('2026-01-01T20:00:00.000Z'),
        });
        prisma.event.findUnique.mockResolvedValue(running);
        prisma.event.update.mockResolvedValue(running);

        await service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
          clientTimestamp: '2026-01-01T21:00:00.000Z',
        });

        expect(prisma.event.update).toHaveBeenCalled();
      });

      it('throws EventConflictException and skips the write when clientTimestamp is older', async () => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        prisma.event.findUnique.mockResolvedValue(
          makeEvent({
            startedAt: new Date('2026-01-01T20:00:00.000Z'),
            endedAt: null,
            updatedAt: new Date('2026-01-01T22:00:00.000Z'),
          }),
        );

        await expect(
          service.stop(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
            clientTimestamp: '2026-01-01T21:00:00.000Z',
          }),
        ).rejects.toThrow(EventConflictException);
        expect(prisma.event.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('remove', () => {
    it('deletes the Event row (no cascade concern, no detail table)', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(makeEvent());

      await service.remove(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: EVENT_ID } });
      expect(prisma.event.delete).toHaveBeenCalledTimes(1);
      expect(realtime.broadcastEventChange).toHaveBeenCalledWith(HOUSEHOLD_ID, {
        type: EventType.SLEEP,
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
          startedAt: new Date('2026-01-01T20:00:00.000Z'),
          endedAt: new Date('2026-01-01T20:12:30.000Z'),
        }),
      );

      const result = await service.findOne(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(result.durationSeconds).toBe(750);
    });

    it('returns null durationSeconds when the timer is still running', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(
        makeEvent({
          startedAt: new Date('2026-01-01T20:00:00.000Z'),
          endedAt: null,
        }),
      );

      const result = await service.findOne(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(result.durationSeconds).toBeNull();
    });
  });
});
