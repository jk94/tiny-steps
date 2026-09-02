import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Child,
  DiaperDetail,
  Event,
  FeedingDetail,
  GrowthMeasurement,
  Milestone,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toChildSex } from '../child/child-sex.enum';
import { ageInDaysAt } from '../common/age/age-in-days';
import { MEASUREMENT_VALUE_FIELDS } from '../growth/growth-measurement.constants';
import { toLengthMeasurementPosition } from '../growth/length-measurement-position.enum';
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
export const RECORD_KIND_MILESTONE = 'MILESTONE';

/** `type` value carried by growth rows, alongside the event types. */
export const GROWTH_EXPORT_TYPE = 'GROWTH';

/** `type` value carried by milestone rows, alongside the event types. */
export const MILESTONE_EXPORT_TYPE = 'MILESTONE';

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
  // --- Appended in roadmap Phase 7.1 -------------------------------------
  // Deliberately at the END of the row, after the original columns: the CSV
  // header is positional for consumers that already parse this export, so new
  // columns are additive only if nothing before them shifts.
  //
  // `recordKind` discriminates the two kinds of record the flat array now
  // holds; the rest are null on every event row. Values are in the stored base
  // units (grams / millimetres, W-3). The percentiles come from the very same
  // pure function the API uses, so an exported number always matches what the
  // app displayed.
  recordKind:
    typeof RECORD_KIND_EVENT | typeof RECORD_KIND_GROWTH_MEASUREMENT | typeof RECORD_KIND_MILESTONE;
  weightGrams: number | null;
  lengthMillimeters: number | null;
  headCircumferenceMillimeters: number | null;
  lengthMeasurementPosition: string | null;
  weightPercentile: number | null;
  lengthPercentile: number | null;
  headCircumferencePercentile: number | null;
  weightZScore: number | null;
  lengthZScore: number | null;
  headCircumferenceZScore: number | null;
  // --- Appended in roadmap Phase 7.2 -------------------------------------
  // Same rule as the Phase 7.1 block above: strictly at the END, after every
  // pre-existing column, so a positional consumer keeps working. Null on every
  // event and growth row.
  //
  // Milestones join the same flat array rather than getting their own export
  // file. That deviates from the phase-7 README's Festlegung 5 ("one dataset
  // per domain") and follows what Phase 7.1 actually did instead — one file
  // with a `recordKind` discriminator is what a spreadsheet user can work
  // with, and 7.4's PDF report is where the per-domain presentation belongs.
  //
  // `milestoneTitle` is the stored, frozen label (see `schema.prisma`), so an
  // export always reads the way the entry read when it was recorded.
  milestoneTemplateKey: string | null;
  milestoneTitle: string | null;
  milestoneCategory: string | null;
  milestonePhotoCount: number | null;
}

const MS_PER_SECOND = 1000;

/** The Phase 7.1 growth columns, blank on any row that is not a measurement. */
const EMPTY_GROWTH_COLUMNS = {
  weightGrams: null,
  lengthMillimeters: null,
  headCircumferenceMillimeters: null,
  lengthMeasurementPosition: null,
  weightPercentile: null,
  lengthPercentile: null,
  headCircumferencePercentile: null,
  weightZScore: null,
  lengthZScore: null,
  headCircumferenceZScore: null,
} as const;

/** The Phase 7.2 milestone columns, blank on any row that is not a milestone. */
const EMPTY_MILESTONE_COLUMNS = {
  milestoneTemplateKey: null,
  milestoneTitle: null,
  milestoneCategory: null,
  milestonePhotoCount: null,
} as const;

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

    // Milestones, same treatment — their `achievedAt` is the milestone
    // equivalent of `occurredAt`. Only the photo *count* is exported: the
    // files themselves are out of scope for a raw-data dump, and their paths
    // never leave the server (M-8).
    const milestones = await this.prisma.milestone.findMany({
      where: { childId, ...(hasRange ? { achievedAt: rangeFilter } : {}) },
      include: { _count: { select: { photos: true } } },
      orderBy: { achievedAt: 'asc' },
    });

    return [
      ...events.map((event) => toRawExportRow(event)),
      ...measurements.map((measurement) => toGrowthExportRow(measurement, child)),
      ...milestones.map((milestone) => toMilestoneExportRow(milestone)),
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
    recordKind: RECORD_KIND_EVENT,
    ...EMPTY_GROWTH_COLUMNS,
    ...EMPTY_MILESTONE_COLUMNS,
  };
}

/**
 * Precision of the derived classification columns.
 *
 * The percentile is rounded to a whole number, matching what the UI shows —
 * an export reading `41.8` next to a screen reading `42` would look like two
 * different numbers. The z-score keeps two decimals, the precision it is
 * quoted with clinically and the reason it is exported alongside the
 * percentile at all (they diverge sharply at the tails).
 */
const EXPORTED_PERCENTILE_DECIMALS = 0;
const EXPORTED_Z_SCORE_DECIMALS = 2;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** The derived columns each stored measurement value feeds. */
const GROWTH_CLASSIFICATION_COLUMNS: Record<
  (typeof MEASUREMENT_VALUE_FIELDS)[number],
  {
    indicator: GrowthIndicator;
    percentileColumn: keyof RawExportRow;
    zScoreColumn: keyof RawExportRow;
  }
> = {
  weightGrams: {
    indicator: 'WEIGHT_FOR_AGE',
    percentileColumn: 'weightPercentile',
    zScoreColumn: 'weightZScore',
  },
  lengthMillimeters: {
    indicator: 'LENGTH_OR_HEIGHT_FOR_AGE',
    percentileColumn: 'lengthPercentile',
    zScoreColumn: 'lengthZScore',
  },
  headCircumferenceMillimeters: {
    indicator: 'HEAD_CIRCUMFERENCE_FOR_AGE',
    percentileColumn: 'headCircumferencePercentile',
    zScoreColumn: 'headCircumferenceZScore',
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

  type ClassificationColumns = Pick<
    RawExportRow,
    | 'weightPercentile'
    | 'lengthPercentile'
    | 'headCircumferencePercentile'
    | 'weightZScore'
    | 'lengthZScore'
    | 'headCircumferenceZScore'
  >;
  const classification: ClassificationColumns = {
    weightPercentile: null,
    lengthPercentile: null,
    headCircumferencePercentile: null,
    weightZScore: null,
    lengthZScore: null,
    headCircumferenceZScore: null,
  };

  for (const field of MEASUREMENT_VALUE_FIELDS) {
    const value = measurement[field];
    if (value === null) {
      continue;
    }
    const { indicator, percentileColumn, zScoreColumn } = GROWTH_CLASSIFICATION_COLUMNS[field];
    const outcome = computeGrowthPercentile({
      indicator,
      sex,
      ageInDays,
      valueInBaseUnit: value,
      bodyMeasurePositionOverride: positionOverride,
    });
    if (outcome.status === 'COMPUTED') {
      // An UNAVAILABLE classification (no sex on the profile, age outside the
      // reference range) stays an empty cell rather than a sentinel number —
      // the raw values next to it are what the export is really about.
      classification[percentileColumn as keyof ClassificationColumns] = roundTo(
        outcome.percentile,
        EXPORTED_PERCENTILE_DECIMALS,
      );
      classification[zScoreColumn as keyof ClassificationColumns] = roundTo(
        outcome.zScore,
        EXPORTED_Z_SCORE_DECIMALS,
      );
    }
  }

  return {
    id: measurement.id,
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
    note: measurement.note,
    createdAt: measurement.createdAt.toISOString(),
    updatedAt: measurement.updatedAt.toISOString(),
    recordKind: RECORD_KIND_GROWTH_MEASUREMENT,
    weightGrams: measurement.weightGrams,
    lengthMillimeters: measurement.lengthMillimeters,
    headCircumferenceMillimeters: measurement.headCircumferenceMillimeters,
    lengthMeasurementPosition: positionOverride,
    ...classification,
    ...EMPTY_MILESTONE_COLUMNS,
  };
}

/**
 * Flattens a milestone into the same row shape as an event.
 *
 * `achievedAt` fills the shared `occurredAt` column so the merged list can be
 * sorted on one key, and every event- and growth-specific column stays null.
 * The milestone's own `title` is used verbatim — it is the frozen label stored
 * at creation time (see `schema.prisma`), so the export never depends on the
 * exporting user's current language.
 */
function toMilestoneExportRow(milestone: Milestone & { _count: { photos: number } }): RawExportRow {
  return {
    id: milestone.id,
    childId: milestone.childId,
    userId: milestone.userId,
    type: MILESTONE_EXPORT_TYPE,
    occurredAt: milestone.achievedAt.toISOString(),
    startedAt: null,
    endedAt: null,
    durationSeconds: null,
    feedingType: null,
    side: null,
    amountMl: null,
    diaperType: null,
    note: milestone.note,
    createdAt: milestone.createdAt.toISOString(),
    updatedAt: milestone.updatedAt.toISOString(),
    recordKind: RECORD_KIND_MILESTONE,
    ...EMPTY_GROWTH_COLUMNS,
    milestoneTemplateKey: milestone.templateKey,
    milestoneTitle: milestone.title,
    milestoneCategory: milestone.category,
    milestonePhotoCount: milestone._count.photos,
  };
}
