import { Injectable, NotFoundException } from '@nestjs/common';
import { Child, DiaperDetail, Event, FeedingDetail } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type EventWithDetails = Event & {
  feedingDetail: FeedingDetail | null;
  diaperDetail: DiaperDetail | null;
};

/**
 * One flattened raw-data row per `Event`, joining the type-specific
 * Feeding/Diaper detail fields as nullable columns. Deliberately *not* the
 * UI-oriented `TimelineEventSummary` union (see `EventService`): an export is
 * a faithful dump of the stored rows, so every column is present for every
 * row regardless of event type (null where a type doesn't carry that field),
 * and the same shape is reused verbatim for both JSON and CSV.
 *
 * All timestamps are ISO-8601 strings, not `Date` objects, so the shape
 * serializes identically for JSON (`JSON.stringify`) and CSV (`toCsv`)
 * without any per-format date handling.
 */
export interface RawExportRow {
  id: string;
  childId: string;
  userId: string;
  type: string;
  occurredAt: string;
  startedAt: string | null;
  endedAt: string | null;
  // Derived from `endedAt - startedAt` when both are present (timer-based
  // events), else null — mirrors the per-type summaries, never stored.
  durationSeconds: number | null;
  feedingType: string | null;
  side: string | null;
  amountMl: number | null;
  diaperType: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

const MS_PER_SECOND = 1000;

/**
 * Read-only raw-data export for a single household's child (Feeding/Sleep/
 * Diaper merged into one chronological list of flattened rows). Query-only,
 * so — like `EventService` — it has no `RealtimeModule` dependency.
 *
 * Reuses the exact `findChildOrThrow` pattern from `EventService`: the
 * `HouseholdMembershipGuard` only proves household membership, not that the
 * requested child actually belongs to that household, so this double-check
 * is what turns a cross-household child id into a 404 rather than leaking
 * another household's data.
 */
@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async getRawEvents(
    householdId: string,
    childId: string,
    from?: Date,
    to?: Date,
  ): Promise<RawExportRow[]> {
    await this.findChildOrThrow(householdId, childId);

    // Build the range from whichever bound(s) are present so a lone `from`
    // (open-ended upper) or lone `to` (open-ended lower) still filters, rather
    // than only both-or-neither.
    const occurredAtFilter: { gte?: Date; lt?: Date } = {};
    if (from) occurredAtFilter.gte = from;
    if (to) occurredAtFilter.lt = to;
    const dateFilter =
      Object.keys(occurredAtFilter).length > 0 ? { occurredAt: occurredAtFilter } : {};

    const events = await this.prisma.event.findMany({
      where: { childId, ...dateFilter },
      include: { feedingDetail: true, diaperDetail: true },
      orderBy: { occurredAt: 'asc' },
    });

    return events.map((event) => toRawExportRow(event));
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

function toRawExportRow(event: EventWithDetails): RawExportRow {
  const durationSeconds =
    event.startedAt && event.endedAt
      ? Math.round((event.endedAt.getTime() - event.startedAt.getTime()) / MS_PER_SECOND)
      : null;

  // A given Event has at most one detail row; `note` may live on either the
  // feeding or diaper detail (Sleep has no detail table at all).
  const note = event.feedingDetail?.note ?? event.diaperDetail?.note ?? null;

  return {
    id: event.id,
    childId: event.childId,
    userId: event.userId,
    type: event.type,
    occurredAt: event.occurredAt.toISOString(),
    startedAt: event.startedAt?.toISOString() ?? null,
    endedAt: event.endedAt?.toISOString() ?? null,
    durationSeconds,
    feedingType: event.feedingDetail?.feedingType ?? null,
    side: event.feedingDetail?.side ?? null,
    amountMl: event.feedingDetail?.amountMl ?? null,
    diaperType: event.diaperDetail?.diaperType ?? null,
    note,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}
