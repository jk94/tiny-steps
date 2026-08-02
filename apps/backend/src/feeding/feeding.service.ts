import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Child, Event, FeedingDetail, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventType } from '../event/event-type.enum';
import { CreateFeedingEventDto } from './dto/create-feeding-event.dto';
import { UpdateFeedingEventDto } from './dto/update-feeding-event.dto';
import { FeedingSide, toFeedingSide } from './feeding-side.enum';
import { FeedingType, toFeedingType } from './feeding-type.enum';

type EventWithFeedingDetail = Event & { feedingDetail: FeedingDetail | null };

export interface FeedingEventSummary {
  id: string;
  childId: string;
  userId: string;
  type: EventType.FEEDING;
  feedingType: FeedingType;
  occurredAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  // Derived at read time from endedAt - startedAt when both are present,
  // else null — never stored, so it can never drift from the two fields it
  // is computed from.
  durationSeconds: number | null;
  side: FeedingSide | null;
  amountMl: number | null;
  note: string | null;
  createdAt: Date;
}

function toSummary(event: EventWithFeedingDetail): FeedingEventSummary {
  const detail = event.feedingDetail;
  if (!detail) {
    // Should be unreachable — every FEEDING Event is created together with
    // its FeedingDetail in the same `create` call (see `create()` below),
    // and `onDelete: Cascade` means it can't outlive its Event either.
    // Defensive boundary mirroring `toAllowedMimeType()` in
    // `child.service.ts`.
    throw new Error(`FEEDING event ${event.id} is missing its FeedingDetail`);
  }

  const durationSeconds =
    event.startedAt && event.endedAt
      ? Math.round((event.endedAt.getTime() - event.startedAt.getTime()) / 1000)
      : null;

  return {
    id: event.id,
    childId: event.childId,
    userId: event.userId,
    type: EventType.FEEDING,
    feedingType: toFeedingType(detail.feedingType),
    occurredAt: event.occurredAt,
    startedAt: event.startedAt,
    endedAt: event.endedAt,
    durationSeconds,
    side: detail.side ? toFeedingSide(detail.side) : null,
    amountMl: detail.amountMl,
    note: detail.note,
    createdAt: event.createdAt,
  };
}

/**
 * CRUD + timer logic for Feeding events, scoped to a household's child.
 * Every lookup filters by `childId` (and the child by `householdId`), so a
 * feeding event belonging to a different child/household is
 * indistinguishable from a nonexistent one — mirrors `ChildService`'s
 * scoping discipline, see its doc comment.
 *
 * `Event` (base row) and `FeedingDetail` (1:1 detail row) are always
 * created/deleted together: `FeedingDetail.eventId` has `onDelete: Cascade`,
 * so `remove()` only needs to delete the `Event` row.
 */
@Injectable()
export class FeedingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    householdId: string,
    childId: string,
    userId: string,
    dto: CreateFeedingEventDto,
  ): Promise<FeedingEventSummary> {
    await this.findChildOrThrow(householdId, childId);

    const isBreast = dto.feedingType === FeedingType.BREAST;
    const startedAt = isBreast
      ? new Date(dto.startedAt ?? dto.occurredAt ?? new Date().toISOString())
      : null;
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : (startedAt ?? new Date());
    const endedAt = isBreast && dto.endedAt ? new Date(dto.endedAt) : null;

    // Mirrors the re-check in `update()` — the DTO-level `@IsEndNotBeforeStart`
    // only validates fields present in the request body, so a BREAST backfill
    // that omits `startedAt` (derived here from `occurredAt`) can still
    // combine with an explicit `endedAt` into a negative-duration event
    // unless re-checked against the *effective* values computed above. Only
    // relevant for BREAST — `startedAt`/`endedAt` are always null otherwise.
    if (
      isBreast &&
      endedAt !== null &&
      startedAt !== null &&
      endedAt.getTime() < startedAt.getTime()
    ) {
      throw new BadRequestException('endedAt must not be before startedAt');
    }

    // Prevents two caregivers starting two concurrent timers for the same
    // child. Deliberately does NOT trigger for a backfilled (already-
    // endedAt-set) BREAST entry, even if a timer happens to be running —
    // only a create that would itself result in `endedAt === null` counts
    // as "starting/resuming a running timer".
    // Known, accepted non-atomicity: this check-then-create isn't wrapped
    // in a transaction/unique constraint, so two concurrent requests could
    // theoretically both pass it — not fixed, SQLite serializes writes in
    // practice and the risk is negligible for a self-hosted family app.
    if (isBreast && endedAt === null) {
      const runningTimer = await this.prisma.event.findFirst({
        where: {
          childId,
          type: EventType.FEEDING,
          endedAt: null,
          feedingDetail: { is: { feedingType: FeedingType.BREAST } },
        },
      });
      if (runningTimer) {
        throw new ConflictException('A breastfeeding timer is already running for this child');
      }
    }

    const event = await this.prisma.event.create({
      data: {
        id: randomUUID(),
        childId,
        userId,
        type: EventType.FEEDING,
        occurredAt,
        startedAt,
        endedAt,
        feedingDetail: {
          create: {
            feedingType: dto.feedingType,
            side: isBreast ? (dto.side ?? null) : null,
            amountMl: dto.feedingType === FeedingType.BOTTLE ? (dto.amountMl ?? null) : null,
            note: dto.note ?? null,
          },
        },
      },
      include: { feedingDetail: true },
    });

    return toSummary(event);
  }

  async list(householdId: string, childId: string): Promise<FeedingEventSummary[]> {
    await this.findChildOrThrow(householdId, childId);

    const events = await this.prisma.event.findMany({
      where: { childId, type: EventType.FEEDING },
      orderBy: { occurredAt: 'desc' },
      include: { feedingDetail: true },
    });

    return events.map(toSummary);
  }

  async findActiveTimer(householdId: string, childId: string): Promise<FeedingEventSummary | null> {
    await this.findChildOrThrow(householdId, childId);

    const event = await this.prisma.event.findFirst({
      where: {
        childId,
        type: EventType.FEEDING,
        endedAt: null,
        feedingDetail: { is: { feedingType: FeedingType.BREAST } },
      },
      include: { feedingDetail: true },
    });

    return event ? toSummary(event) : null;
  }

  async findOne(
    householdId: string,
    childId: string,
    eventId: string,
  ): Promise<FeedingEventSummary> {
    const event = await this.findFeedingEventOrThrow(householdId, childId, eventId);
    return toSummary(event);
  }

  async update(
    householdId: string,
    childId: string,
    eventId: string,
    dto: UpdateFeedingEventDto,
  ): Promise<FeedingEventSummary> {
    const existing = await this.findFeedingEventOrThrow(householdId, childId, eventId);
    // Guaranteed non-null by findFeedingEventOrThrow/toSummary's own
    // invariant check.
    const existingFeedingType = toFeedingType(existing.feedingDetail!.feedingType);

    const eventData: Prisma.EventUpdateInput = {};
    if (dto.occurredAt !== undefined) {
      eventData.occurredAt = new Date(dto.occurredAt);
    }
    if (dto.startedAt !== undefined) {
      eventData.startedAt = new Date(dto.startedAt);
    }
    if (dto.endedAt !== undefined) {
      eventData.endedAt = new Date(dto.endedAt);
    }

    // The DTO-level `@IsEndNotBeforeStart` only sees fields present in THIS
    // request body — a PATCH supplying only `endedAt` (or only
    // `startedAt`) needs the merged effective values re-checked against
    // what's already stored, which is only known here.
    const effectiveStartedAt = (eventData.startedAt as Date | undefined) ?? existing.startedAt;
    const effectiveEndedAt = (eventData.endedAt as Date | undefined) ?? existing.endedAt;
    if (
      effectiveStartedAt &&
      effectiveEndedAt &&
      effectiveEndedAt.getTime() < effectiveStartedAt.getTime()
    ) {
      throw new BadRequestException('endedAt must not be before startedAt');
    }

    // feedingType is immutable, so which of side/amountMl are relevant is
    // fixed by the existing row — a field irrelevant to it is silently
    // discarded, same trusted-household-member rationale as `create()`.
    const detailData: Prisma.FeedingDetailUpdateInput = {};
    if (dto.side !== undefined && existingFeedingType === FeedingType.BREAST) {
      detailData.side = dto.side;
    }
    if (dto.amountMl !== undefined && existingFeedingType === FeedingType.BOTTLE) {
      detailData.amountMl = dto.amountMl;
    }
    if (dto.note !== undefined) {
      detailData.note = dto.note;
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...eventData,
        feedingDetail: Object.keys(detailData).length > 0 ? { update: detailData } : undefined,
      },
      include: { feedingDetail: true },
    });

    return toSummary(updated);
  }

  async stop(householdId: string, childId: string, eventId: string): Promise<FeedingEventSummary> {
    const existing = await this.findFeedingEventOrThrow(householdId, childId, eventId);
    const feedingType = toFeedingType(existing.feedingDetail!.feedingType);

    if (feedingType !== FeedingType.BREAST) {
      throw new ConflictException('Only breastfeeding events have a timer to stop');
    }
    if (existing.endedAt !== null) {
      throw new ConflictException('This feeding event has already been stopped');
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { endedAt: new Date() },
      include: { feedingDetail: true },
    });

    return toSummary(updated);
  }

  async remove(householdId: string, childId: string, eventId: string): Promise<void> {
    await this.findFeedingEventOrThrow(householdId, childId, eventId);
    // Deletes the FeedingDetail too, via `onDelete: Cascade` — no manual
    // two-step delete needed here.
    await this.prisma.event.delete({ where: { id: eventId } });
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

  private async findFeedingEventOrThrow(
    householdId: string,
    childId: string,
    eventId: string,
  ): Promise<EventWithFeedingDetail> {
    await this.findChildOrThrow(householdId, childId);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId, childId, type: EventType.FEEDING },
      include: { feedingDetail: true },
    });

    if (!event) {
      throw new NotFoundException();
    }

    return event;
  }
}
