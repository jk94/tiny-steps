import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventType } from '../event/event-type.enum';
import type { RealtimeService } from '../realtime/realtime.service';
import { CreateDiaperEventDto } from './dto/create-diaper-event.dto';
import { UpdateDiaperEventDto } from './dto/update-diaper-event.dto';
import { DiaperService } from './diaper.service';
import { DiaperType } from './diaper-type.enum';

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
    type: EventType.DIAPER,
    occurredAt: new Date('2026-01-01T10:00:00.000Z'),
    startedAt: null,
    endedAt: null,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    diaperDetail: {
      eventId: EVENT_ID,
      diaperType: DiaperType.PEE,
      note: null,
    },
    ...overrides,
  };
}

describe('DiaperService', () => {
  let prisma: {
    child: { findUnique: jest.Mock };
    event: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let realtime: { broadcastEventChange: jest.Mock };
  let service: DiaperService;

  beforeEach(() => {
    prisma = {
      child: { findUnique: jest.fn() },
      event: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    realtime = { broadcastEventChange: jest.fn() };
    service = new DiaperService(
      prisma as unknown as PrismaService,
      realtime as unknown as RealtimeService,
    );
  });

  describe('create', () => {
    it('throws NotFoundException when the child is not in the household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(
        service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, { diaperType: DiaperType.PEE }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it.each([DiaperType.PEE, DiaperType.STOOL, DiaperType.BOTH])(
      'creates an Event + DiaperDetail for diaperType %s with startedAt/endedAt always null',
      async (diaperType) => {
        prisma.child.findUnique.mockResolvedValue(makeChild());
        prisma.event.create.mockResolvedValue(
          makeEvent({ diaperDetail: { eventId: EVENT_ID, diaperType, note: null } }),
        );

        await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, { diaperType });

        expect(prisma.event.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            childId: CHILD_ID,
            userId: USER_ID,
            type: EventType.DIAPER,
            startedAt: null,
            endedAt: null,
            diaperDetail: { create: { diaperType, note: null } },
          }),
          include: { diaperDetail: true },
        });
      },
    );

    it('defaults occurredAt to now when omitted', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.create.mockResolvedValue(makeEvent());

      await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, { diaperType: DiaperType.PEE });

      const createArgs = prisma.event.create.mock.calls[0][0];
      expect(createArgs.data.occurredAt).toBeInstanceOf(Date);
    });

    it('uses the given occurredAt when provided', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.create.mockResolvedValue(makeEvent());
      const dto: CreateDiaperEventDto = {
        diaperType: DiaperType.STOOL,
        occurredAt: '2026-01-01T08:00:00.000Z',
      };

      await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, dto);

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          occurredAt: new Date('2026-01-01T08:00:00.000Z'),
        }),
        include: { diaperDetail: true },
      });
    });

    it('persists note when given', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.create.mockResolvedValue(
        makeEvent({
          diaperDetail: { eventId: EVENT_ID, diaperType: DiaperType.BOTH, note: 'Diaper rash' },
        }),
      );

      await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        diaperType: DiaperType.BOTH,
        note: 'Diaper rash',
      });

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          diaperDetail: { create: { diaperType: DiaperType.BOTH, note: 'Diaper rash' } },
        }),
        include: { diaperDetail: true },
      });
    });

    it('persists note as null when omitted', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.create.mockResolvedValue(makeEvent());

      await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, { diaperType: DiaperType.PEE });

      expect(prisma.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          diaperDetail: { create: { diaperType: DiaperType.PEE, note: null } },
        }),
        include: { diaperDetail: true },
      });
    });

    it('broadcasts a created event:changed message on success', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.create.mockResolvedValue(makeEvent());

      await service.create(HOUSEHOLD_ID, CHILD_ID, USER_ID, { diaperType: DiaperType.PEE });

      expect(realtime.broadcastEventChange).toHaveBeenCalledWith(HOUSEHOLD_ID, {
        type: EventType.DIAPER,
        action: 'created',
        eventId: EVENT_ID,
        childId: CHILD_ID,
        householdId: HOUSEHOLD_ID,
      });
    });
  });

  describe('list', () => {
    it('scopes by childId + type DIAPER, ordered occurredAt desc', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findMany.mockResolvedValue([makeEvent()]);

      const result = await service.list(HOUSEHOLD_ID, CHILD_ID);

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { childId: CHILD_ID, type: EventType.DIAPER },
        orderBy: { occurredAt: 'desc' },
        include: { diaperDetail: true },
      });
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException for a child in a different household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.list(HOUSEHOLD_ID, CHILD_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('returns the mapped summary when found', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(makeEvent());

      const result = await service.findOne(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: { id: EVENT_ID, childId: CHILD_ID, type: EventType.DIAPER },
        include: { diaperDetail: true },
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
    it('patches occurredAt only when supplied', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(makeEvent());
      prisma.event.update.mockResolvedValue(
        makeEvent({ occurredAt: new Date('2026-01-01T09:00:00.000Z') }),
      );

      const dto: UpdateDiaperEventDto = { occurredAt: '2026-01-01T09:00:00.000Z' };
      await service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, dto);

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { occurredAt: new Date('2026-01-01T09:00:00.000Z'), diaperDetail: undefined },
        include: { diaperDetail: true },
      });
      expect(realtime.broadcastEventChange).toHaveBeenCalledWith(HOUSEHOLD_ID, {
        type: EventType.DIAPER,
        action: 'updated',
        eventId: EVENT_ID,
        childId: CHILD_ID,
        householdId: HOUSEHOLD_ID,
      });
    });

    it('patches diaperType and note independently', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(makeEvent());
      prisma.event.update.mockResolvedValue(makeEvent());

      await service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, { diaperType: DiaperType.STOOL });

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { diaperDetail: { update: { diaperType: DiaperType.STOOL } } },
        include: { diaperDetail: true },
      });
    });

    it('patches diaperType and note together', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(makeEvent());
      prisma.event.update.mockResolvedValue(makeEvent());

      await service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
        diaperType: DiaperType.BOTH,
        note: 'Needs cream',
      });

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { diaperDetail: { update: { diaperType: DiaperType.BOTH, note: 'Needs cream' } } },
        include: { diaperDetail: true },
      });
    });

    it('clears an existing note when the DTO explicitly sends note: null', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(makeEvent());
      prisma.event.update.mockResolvedValue(makeEvent());

      // Distinct from "leaves untouched fields alone" below, where `note`
      // is simply absent from the DTO (left untouched) — here it is
      // explicitly `null` (cleared).
      await service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, { note: null });

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { diaperDetail: { update: { note: null } } },
        include: { diaperDetail: true },
      });
    });

    it('leaves untouched fields alone on a partial update', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(makeEvent());
      prisma.event.update.mockResolvedValue(makeEvent());

      await service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, { note: 'Just a note' });

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { diaperDetail: { update: { note: 'Just a note' } } },
        include: { diaperDetail: true },
      });
    });

    it('throws NotFoundException when scoped to a different child/household', async () => {
      prisma.child.findUnique.mockResolvedValue(null);

      await expect(service.update(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, { note: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes only the Event row, relying on cascade for DiaperDetail', async () => {
      prisma.child.findUnique.mockResolvedValue(makeChild());
      prisma.event.findUnique.mockResolvedValue(makeEvent());

      await service.remove(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

      expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: EVENT_ID } });
      expect(prisma.event.delete).toHaveBeenCalledTimes(1);
      expect(realtime.broadcastEventChange).toHaveBeenCalledWith(HOUSEHOLD_ID, {
        type: EventType.DIAPER,
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
});
