import { Injectable, NotFoundException } from '@nestjs/common';
import { Child } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toDiaperEventSummary } from '../diaper/diaper.service';
import type { DiaperEventSummary } from '../diaper/diaper.service';
import { toFeedingEventSummary } from '../feeding/feeding.service';
import type { FeedingEventSummary } from '../feeding/feeding.service';
import { toSleepEventSummary } from '../sleep/sleep.service';
import type { SleepEventSummary } from '../sleep/sleep.service';
import { EventType } from './event-type.enum';

/**
 * Discriminated union of the three existing per-type summaries, discriminated
 * by their shared `type` field — deliberately not a new shape of its own, so
 * a consumer can `switch` on `.type` and get the exact same fields the
 * per-type pages already render.
 */
export type TimelineEventSummary = FeedingEventSummary | SleepEventSummary | DiaperEventSummary;

export interface EventStatsSummary {
  // Rounded to 1 decimal — see `getStatsSummary`'s own doc comment for why
  // an ongoing/unfinished sleep timer is excluded from the sum.
  sleepHoursToday: number;
  feedingCountToday: number;
  // NOT date-filtered — "most recent ever" per type, not "most recent
  // today". See `getStatsSummary`'s own doc comment.
  lastEventAt: {
    FEEDING: Date | null;
    SLEEP: Date | null;
    DIAPER: Date | null;
  };
}

const HOURS_DECIMAL_PLACES = 1;
const MS_PER_HOUR = 1000 * 60 * 60;

/**
 * Read-only queries spanning all three event types (Feeding/Sleep/Diaper),
 * scoped to a household's child — for the daily timeline and stats views
 * (Phase 3). Deliberately has no `RealtimeModule` dependency: nothing here
 * mutates, so there's nothing to broadcast (unlike `FeedingService` et al.).
 *
 * Reuses the exact per-type mapping functions
 * (`toFeedingEventSummary`/`toSleepEventSummary`/`toDiaperEventSummary`)
 * exported by their respective services rather than reimplementing duration
 * derivation here — a single query result row (with both `feedingDetail` and
 * `diaperDetail` included) is structurally compatible with whichever
 * type-specific mapper matches its `type` field.
 */
@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  async listDaily(
    householdId: string,
    childId: string,
    from: Date,
    to: Date,
  ): Promise<TimelineEventSummary[]> {
    await this.findChildOrThrow(householdId, childId);

    const events = await this.prisma.event.findMany({
      where: { childId, occurredAt: { gte: from, lt: to } },
      include: { feedingDetail: true, diaperDetail: true },
      orderBy: { occurredAt: 'asc' },
    });

    return events.map((event) => {
      switch (event.type) {
        case EventType.FEEDING:
          return toFeedingEventSummary(event);
        case EventType.SLEEP:
          return toSleepEventSummary(event);
        case EventType.DIAPER:
          return toDiaperEventSummary(event);
        default:
          // Defensive boundary mirroring `toEventType()` — the DB column is
          // an untyped `String`, so an unrecognized value can only reach
          // here via direct DB tampering/a future unhandled event type.
          throw new Error(`Unhandled EventType: ${event.type}`);
      }
    });
  }

  async getStatsSummary(
    householdId: string,
    childId: string,
    from: Date,
    to: Date,
  ): Promise<EventStatsSummary> {
    await this.findChildOrThrow(householdId, childId);

    const [feedingCountToday, sleepEventsToday, lastFeeding, lastSleep, lastDiaper] =
      await Promise.all([
        this.prisma.event.count({
          where: { childId, type: EventType.FEEDING, occurredAt: { gte: from, lt: to } },
        }),
        this.prisma.event.findMany({
          where: { childId, type: EventType.SLEEP, occurredAt: { gte: from, lt: to } },
        }),
        this.prisma.event.findFirst({
          where: { childId, type: EventType.FEEDING },
          orderBy: { occurredAt: 'desc' },
        }),
        this.prisma.event.findFirst({
          where: { childId, type: EventType.SLEEP },
          orderBy: { occurredAt: 'desc' },
        }),
        this.prisma.event.findFirst({
          where: { childId, type: EventType.DIAPER },
          orderBy: { occurredAt: 'desc' },
        }),
      ]);

    // An ongoing/unfinished sleep timer (endedAt === null) that started
    // in-range is excluded from the sum — its true duration is unknown
    // until it's stopped, so counting it would understate or fabricate a
    // number that changes retroactively once the timer stops.
    const sleepMillisToday = sleepEventsToday.reduce((total, event) => {
      if (event.startedAt === null || event.endedAt === null) {
        return total;
      }
      return total + (event.endedAt.getTime() - event.startedAt.getTime());
    }, 0);
    const sleepHoursToday = round(sleepMillisToday / MS_PER_HOUR, HOURS_DECIMAL_PLACES);

    return {
      sleepHoursToday,
      feedingCountToday,
      lastEventAt: {
        FEEDING: lastFeeding?.occurredAt ?? null,
        SLEEP: lastSleep?.occurredAt ?? null,
        DIAPER: lastDiaper?.occurredAt ?? null,
      },
    };
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
}

function round(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}
