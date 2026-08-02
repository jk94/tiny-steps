import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Child, DiaperDetail, Event, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventType } from '../event/event-type.enum';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateDiaperEventDto } from './dto/create-diaper-event.dto';
import { UpdateDiaperEventDto } from './dto/update-diaper-event.dto';
import { DiaperType, toDiaperType } from './diaper-type.enum';

type EventWithDiaperDetail = Event & { diaperDetail: DiaperDetail | null };

/**
 * No `startedAt`/`endedAt`/`durationSeconds` fields at all, deliberately
 * diverging from `FeedingEventSummary`/`SleepEventSummary` — Diaper is
 * always a point event (`Event.startedAt`/`endedAt` are never set, see
 * `DiaperService`'s own doc comment below), so those fields would always
 * be null/meaningless here.
 */
export interface DiaperEventSummary {
  id: string;
  childId: string;
  userId: string;
  type: EventType.DIAPER;
  diaperType: DiaperType;
  occurredAt: Date;
  note: string | null;
  createdAt: Date;
}

// Exported so EventService.listDaily can reuse the exact same mapping
// logic for the merged daily timeline — see EventService's own doc comment.
export function toDiaperEventSummary(event: EventWithDiaperDetail): DiaperEventSummary {
  const detail = event.diaperDetail;
  if (!detail) {
    // Should be unreachable — every DIAPER Event is created together with
    // its DiaperDetail in the same `create` call (see `create()` below),
    // and `onDelete: Cascade` means it can't outlive its Event either.
    // Defensive boundary mirroring `FeedingService.toFeedingEventSummary()`.
    throw new Error(`DIAPER event ${event.id} is missing its DiaperDetail`);
  }

  return {
    id: event.id,
    childId: event.childId,
    userId: event.userId,
    type: EventType.DIAPER,
    diaperType: toDiaperType(detail.diaperType),
    occurredAt: event.occurredAt,
    note: detail.note,
    createdAt: event.createdAt,
  };
}

/**
 * CRUD logic for Diaper events, scoped to a household's child. Every
 * lookup filters by `childId` (and the child by `householdId`), so a
 * diaper event belonging to a different child/household is
 * indistinguishable from a nonexistent one — mirrors `ChildService`'s/
 * `FeedingService`'s scoping discipline, see their doc comments.
 *
 * Unlike `FeedingService`/`SleepService`, Diaper is never timer-based:
 * `Event.startedAt`/`endedAt` are always null for DIAPER events, and this
 * service has no `findActiveTimer()`/`stop()` and no conflict check at
 * create time.
 *
 * `Event` (base row) and `DiaperDetail` (1:1 detail row) are always
 * created/deleted together: `DiaperDetail.eventId` has `onDelete: Cascade`,
 * so `remove()` only needs to delete the `Event` row.
 *
 * `create`/`update`/`remove` each broadcast an `event:changed` message to
 * the household's WebSocket room via `RealtimeService` after the write
 * succeeds — same rationale as `FeedingService`'s identical doc comment
 * (no `stop()` here, so there's no timer-stop call site to also cover).
 */
@Injectable()
export class DiaperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(
    householdId: string,
    childId: string,
    userId: string,
    dto: CreateDiaperEventDto,
  ): Promise<DiaperEventSummary> {
    await this.findChildOrThrow(householdId, childId);

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    const event = await this.prisma.event.create({
      data: {
        id: randomUUID(),
        childId,
        userId,
        type: EventType.DIAPER,
        occurredAt,
        startedAt: null,
        endedAt: null,
        diaperDetail: {
          create: {
            diaperType: dto.diaperType,
            note: dto.note ?? null,
          },
        },
      },
      include: { diaperDetail: true },
    });

    this.realtime.broadcastEventChange(householdId, {
      type: EventType.DIAPER,
      action: 'created',
      eventId: event.id,
      childId,
      householdId,
    });

    return toDiaperEventSummary(event);
  }

  async list(householdId: string, childId: string): Promise<DiaperEventSummary[]> {
    await this.findChildOrThrow(householdId, childId);

    const events = await this.prisma.event.findMany({
      where: { childId, type: EventType.DIAPER },
      orderBy: { occurredAt: 'desc' },
      include: { diaperDetail: true },
    });

    return events.map(toDiaperEventSummary);
  }

  async findOne(
    householdId: string,
    childId: string,
    eventId: string,
  ): Promise<DiaperEventSummary> {
    const event = await this.findDiaperEventOrThrow(householdId, childId, eventId);
    return toDiaperEventSummary(event);
  }

  async update(
    householdId: string,
    childId: string,
    eventId: string,
    dto: UpdateDiaperEventDto,
  ): Promise<DiaperEventSummary> {
    await this.findDiaperEventOrThrow(householdId, childId, eventId);

    const eventData: Prisma.EventUpdateInput = {};
    if (dto.occurredAt !== undefined) {
      eventData.occurredAt = new Date(dto.occurredAt);
    }

    // Unlike Feeding, diaperType is unconditionally editable (see
    // `UpdateDiaperEventDto`'s doc comment) and note applies uniformly to
    // every diaperType, so both are unconditionally settable here.
    const detailData: Prisma.DiaperDetailUpdateInput = {};
    if (dto.diaperType !== undefined) {
      detailData.diaperType = dto.diaperType;
    }
    if (dto.note !== undefined) {
      detailData.note = dto.note;
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...eventData,
        diaperDetail: Object.keys(detailData).length > 0 ? { update: detailData } : undefined,
      },
      include: { diaperDetail: true },
    });

    this.realtime.broadcastEventChange(householdId, {
      type: EventType.DIAPER,
      action: 'updated',
      eventId,
      childId,
      householdId,
    });

    return toDiaperEventSummary(updated);
  }

  async remove(householdId: string, childId: string, eventId: string): Promise<void> {
    await this.findDiaperEventOrThrow(householdId, childId, eventId);
    // Deletes the DiaperDetail too, via `onDelete: Cascade` — no manual
    // two-step delete needed here.
    await this.prisma.event.delete({ where: { id: eventId } });

    this.realtime.broadcastEventChange(householdId, {
      type: EventType.DIAPER,
      action: 'deleted',
      eventId,
      childId,
      householdId,
    });
  }

  private async findChildOrThrow(householdId: string, childId: string): Promise<Child> {
    const child = await this.prisma.child.findUnique({
      where: { id: childId, householdId },
    });

    if (!child) {
      throw new NotFoundException();
    }

    return child;
  }

  private async findDiaperEventOrThrow(
    householdId: string,
    childId: string,
    eventId: string,
  ): Promise<EventWithDiaperDetail> {
    await this.findChildOrThrow(householdId, childId);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId, childId, type: EventType.DIAPER },
      include: { diaperDetail: true },
    });

    if (!event) {
      throw new NotFoundException();
    }

    return event;
  }
}
