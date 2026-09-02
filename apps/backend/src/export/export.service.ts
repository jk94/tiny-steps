import { Injectable, NotFoundException } from '@nestjs/common';
import { Child, DiaperDetail, Event, FeedingDetail, GrowthMeasurement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toChildSex } from '../child/child-sex.enum';
import { MEASUREMENT_VALUE_FIELDS } from '../growth/growth-measurement.constants';
import { toLengthMeasurementPosition } from '../growth/length-measurement-position.enum';
import { ageInDaysAt } from '../growth/percentiles/age-in-days';
import {
  computeGrowthPercentile,
  type GrowthIndicator,
} from '../growth/percentiles/growth-percentiles';

type EventWithDetails = Event & {
  feedingDetail: FeedingDetail | null;
  diaperDetail: DiaperDetail | null;
};

/**
 * Discriminates the two kinds of record the export contains. Added when
 * growth measurements joined the export (roadmap Phase 7.1): they live in
 * their own table beside `Event` (see ADR-0006's addendum), but the export
 * stays a single flat array, so a reader needs an explicit column to tell the
 * two apart rather than inferring it from which columns happen to be null.
 * Every pre-existing row is an `EVENT`.
 */
export const RECORD_KIND_EVENT = 'EVENT';
export const RECORD_KIND_GROWTH_MEASUREMENT = 'GROWTH_MEASUREMENT';

/** `type` value carried by growth rows, alongside the event types. */
export const GROWTH_EXPORT_TYPE = 'GROWTH';

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
  recordKind: typeof RECORD_KIND_EVENT | typeof RECORD_KIND_GROWTH_MEASUREMENT;
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
  // Growth columns (null on event rows). Values are in the stored base units
  // (grams / millimetres, W-3); the percentiles are computed with the very
  // same pure function the API uses, so an exported number always matches
  // what the app displayed.
  weightGrams: number | null;
  lengthMillimeters: number | null;
  headCircumferenceMillimeters: number | null;
  lengthMeasurementPosition: string | null;
  weightPercentile: number | null;
  lengthPercentile: number | null;
  headCircumferencePercentile: number | null;
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
    const child = await this.findChildOrThrow(householdId, childId);

    // Build the range from whichever bound(s) are present so a lone `from`
    // (open-ended upper) or lone `to` (open-ended lower) still filters, rather
    // than only both-or-neither.
    const rangeFilter: { gte?: Date; lt?: Date } = {};
    if (from) rangeFilter.gte = from;
    if (to) rangeFilter.lt = to;
    const hasRange = Object.keys(rangeFilter).length > 0;

    const events = await this.prisma.event.findMany({
      where: { childId, ...(hasRange ? { occurredAt: rangeFilter } : {}) },
      include: { feedingDetail: true, diaperDetail: true },
      orderBy: { occurredAt: 'asc' },
    });

    // Growth measurements live in their own table (ADR-0006 addendum) but
    // belong in the same flat export, so they are fetched with the same child
    // scoping and the same window — applied to `measuredAt`, which is the
    // growth equivalent of `occurredAt`.
    const measurements = await this.prisma.growthMeasurement.findMany({
      where: { childId, ...(hasRange ? { measuredAt: rangeFilter } : {}) },
      orderBy: { measuredAt: 'asc' },
    });

    return [
      ...events.map((event) => toRawExportRow(event)),
      ...measurements.map((measurement) => toGrowthExportRow(measurement, child)),
    ].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
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
    recordKind: RECORD_KIND_EVENT,
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
    weightGrams: null,
    lengthMillimeters: null,
    headCircumferenceMillimeters: null,
    lengthMeasurementPosition: null,
    weightPercentile: null,
    lengthPercentile: null,
    headCircumferencePercentile: null,
    note,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

/** The percentile column each stored measurement value feeds. */
const GROWTH_PERCENTILE_COLUMNS: Record<
  (typeof MEASUREMENT_VALUE_FIELDS)[number],
  { indicator: GrowthIndicator; column: keyof RawExportRow }
> = {
  weightGrams: { indicator: 'WEIGHT_FOR_AGE', column: 'weightPercentile' },
  lengthMillimeters: { indicator: 'LENGTH_OR_HEIGHT_FOR_AGE', column: 'lengthPercentile' },
  headCircumferenceMillimeters: {
    indicator: 'HEAD_CIRCUMFERENCE_FOR_AGE',
    column: 'headCircumferencePercentile',
  },
};

/**
 * Flattens a growth measurement into the same row shape as an event.
 *
 * `measuredAt` fills the shared `occurredAt` column so the merged list can be
 * sorted on one key, and the event-only columns stay null. Percentiles are
 * computed through the same pure function the API uses, so an exported value
 * is identical to the one the app displayed (and to the one the later PDF
 * report will show) rather than a second, subtly different derivation.
 */
function toGrowthExportRow(measurement: GrowthMeasurement, child: Child): RawExportRow {
  const ageInDays = ageInDaysAt(child.birthDate, measurement.measuredAt);
  const sex = child.sex ? toChildSex(child.sex) : null;
  const positionOverride = measurement.lengthMeasurementPosition
    ? toLengthMeasurementPosition(measurement.lengthMeasurementPosition)
    : null;

  const percentiles: Pick<
    RawExportRow,
    'weightPercentile' | 'lengthPercentile' | 'headCircumferencePercentile'
  > = { weightPercentile: null, lengthPercentile: null, headCircumferencePercentile: null };

  for (const field of MEASUREMENT_VALUE_FIELDS) {
    const value = measurement[field];
    if (value === null) {
      continue;
    }
    const { indicator, column } = GROWTH_PERCENTILE_COLUMNS[field];
    const outcome = computeGrowthPercentile({
      indicator,
      sex,
      ageInDays,
      valueInBaseUnit: value,
      bodyMeasurePositionOverride: positionOverride,
    });
    if (outcome.status === 'COMPUTED') {
      // An UNAVAILABLE classification (no sex on the profile, age past the
      // reference range) stays an empty cell rather than a sentinel number —
      // the raw values next to it are what the export is really about.
      percentiles[column as keyof typeof percentiles] = outcome.percentile;
    }
  }

  return {
    id: measurement.id,
    recordKind: RECORD_KIND_GROWTH_MEASUREMENT,
    childId: measurement.childId,
    userId: measurement.userId,
    type: GROWTH_EXPORT_TYPE,
    occurredAt: measurement.measuredAt.toISOString(),
    startedAt: null,
    endedAt: null,
    durationSeconds: null,
    feedingType: null,
    side: null,
    amountMl: null,
    diaperType: null,
    weightGrams: measurement.weightGrams,
    lengthMillimeters: measurement.lengthMillimeters,
    headCircumferenceMillimeters: measurement.headCircumferenceMillimeters,
    lengthMeasurementPosition: positionOverride,
    ...percentiles,
    note: measurement.note,
    createdAt: measurement.createdAt.toISOString(),
    updatedAt: measurement.updatedAt.toISOString(),
  };
}
