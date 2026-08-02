import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Child, Event, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventType } from '../event/event-type.enum';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateSleepEventDto } from './dto/create-sleep-event.dto';
import { UpdateSleepEventDto } from './dto/update-sleep-event.dto';

export interface SleepEventSummary {
  id: string;
  childId: string;
  userId: string;
  type: EventType.SLEEP;
  occurredAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  // Derived at read time from endedAt - startedAt when both are present,
  // else null — never stored, so it can never drift from the two fields it
  // is computed from. Same computation as FeedingService.toSummary.
  durationSeconds: number | null;
  createdAt: Date;
}

function toSummary(event: Event): SleepEventSummary {
  const durationSeconds =
    event.startedAt && event.endedAt
      ? Math.round((event.endedAt.getTime() - event.startedAt.getTime()) / 1000)
      : null;

  return {
    id: event.id,
    childId: event.childId,
    userId: event.userId,
    type: EventType.SLEEP,
    occurredAt: event.occurredAt,
    startedAt: event.startedAt,
    endedAt: event.endedAt,
    durationSeconds,
    createdAt: event.createdAt,
  };
}

/**
 * CRUD + timer logic for Sleep events, scoped to a household's child. Every
 * lookup filters by `childId` (and the child by `householdId`), so a sleep
 * event belonging to a different child/household is indistinguishable from
 * a nonexistent one — mirrors `ChildService`'s/`FeedingService`'s scoping
 * discipline.
 *
 * Unlike `FeedingService`, there is no detail table to join/include
 * anywhere: Sleep is a pure base-`Event` type (see ADR-0006's addendum),
 * so every read/write here operates on `Event` alone.
 *
 * Every mutating method (`create`/`update`/`remove`/`stop`) broadcasts an
 * `event:changed` message to the household's WebSocket room via
 * `RealtimeService` after the write succeeds — same rationale as
 * `FeedingService`'s identical doc comment.
 */
@Injectable()
export class SleepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(
    householdId: string,
    childId: string,
    userId: string,
    dto: CreateSleepEventDto,
  ): Promise<SleepEventSummary> {
    await this.findChildOrThrow(householdId, childId);

    const startedAt = new Date(dto.startedAt ?? dto.occurredAt ?? new Date().toISOString());
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : startedAt;
    const endedAt = dto.endedAt ? new Date(dto.endedAt) : null;

    // Mirrors the re-check in `update()` — the DTO-level `@IsEndNotBeforeStart`
    // only validates fields present in the request body, so a backfill that
    // omits `startedAt` (derived here from `occurredAt`) can still combine
    // with an explicit `endedAt` into a negative-duration event unless
    // re-checked against the *effective* values computed above.
    if (endedAt !== null && endedAt.getTime() < startedAt.getTime()) {
      throw new BadRequestException('endedAt must not be before startedAt');
    }

    // Prevents two caregivers starting two concurrent sleep timers for the
    // same child. Unconditional (no type-gating, unlike Feeding's BREAST-only
    // check) since Sleep has no non-timer sub-type to exempt — it only does
    // NOT trigger for a backfilled (already-endedAt-set) entry, even if a
    // timer happens to be running.
    // Known, accepted non-atomicity: this check-then-create isn't wrapped in
    // a transaction/unique constraint, so two concurrent requests could
    // theoretically both pass it — not fixed, SQLite serializes writes in
    // practice and the risk is negligible for a self-hosted family app.
    if (endedAt === null) {
      const runningTimer = await this.prisma.event.findFirst({
        where: { childId, type: EventType.SLEEP, endedAt: null },
      });
      if (runningTimer) {
        throw new ConflictException('A sleep timer is already running for this child');
      }
    }

    const event = await this.prisma.event.create({
      data: {
        id: randomUUID(),
        childId,
        userId,
        type: EventType.SLEEP,
        occurredAt,
        startedAt,
        endedAt,
      },
    });

    this.realtime.broadcastEventChange(householdId, {
      type: EventType.SLEEP,
      action: 'created',
      eventId: event.id,
      childId,
      householdId,
    });

    return toSummary(event);
  }

  async list(householdId: string, childId: string): Promise<SleepEventSummary[]> {
    await this.findChildOrThrow(householdId, childId);

    const events = await this.prisma.event.findMany({
      where: { childId, type: EventType.SLEEP },
      orderBy: { occurredAt: 'desc' },
    });

    return events.map(toSummary);
  }

  async findActiveTimer(householdId: string, childId: string): Promise<SleepEventSummary | null> {
    await this.findChildOrThrow(householdId, childId);

    const event = await this.prisma.event.findFirst({
      where: { childId, type: EventType.SLEEP, endedAt: null },
    });

    return event ? toSummary(event) : null;
  }

  async findOne(householdId: string, childId: string, eventId: string): Promise<SleepEventSummary> {
    const event = await this.findSleepEventOrThrow(householdId, childId, eventId);
    return toSummary(event);
  }

  async update(
    householdId: string,
    childId: string,
    eventId: string,
    dto: UpdateSleepEventDto,
  ): Promise<SleepEventSummary> {
    const existing = await this.findSleepEventOrThrow(householdId, childId, eventId);

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

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: eventData,
    });

    this.realtime.broadcastEventChange(householdId, {
      type: EventType.SLEEP,
      action: 'updated',
      eventId,
      childId,
      householdId,
    });

    return toSummary(updated);
  }

  async stop(householdId: string, childId: string, eventId: string): Promise<SleepEventSummary> {
    const existing = await this.findSleepEventOrThrow(householdId, childId, eventId);

    // No "wrong type" guard needed here, unlike FeedingService.stop — every
    // Sleep event is timer-capable, there's no non-timer sub-type to reject.
    if (existing.endedAt !== null) {
      throw new ConflictException('This sleep event has already been stopped');
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { endedAt: new Date() },
    });

    // Collapsed into the generic 'updated' action — same rationale as
    // FeedingService.stop's identical doc comment.
    this.realtime.broadcastEventChange(householdId, {
      type: EventType.SLEEP,
      action: 'updated',
      eventId,
      childId,
      householdId,
    });

    return toSummary(updated);
  }

  async remove(householdId: string, childId: string, eventId: string): Promise<void> {
    await this.findSleepEventOrThrow(householdId, childId, eventId);
    // No cascade concern here, unlike FeedingService.remove — there's no
    // detail table row to clean up.
    await this.prisma.event.delete({ where: { id: eventId } });

    this.realtime.broadcastEventChange(householdId, {
      type: EventType.SLEEP,
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

  private async findSleepEventOrThrow(
    householdId: string,
    childId: string,
    eventId: string,
  ): Promise<Event> {
    await this.findChildOrThrow(householdId, childId);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId, childId, type: EventType.SLEEP },
    });

    if (!event) {
      throw new NotFoundException();
    }

    return event;
  }
}
