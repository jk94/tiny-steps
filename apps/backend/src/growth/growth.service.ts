import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Child, GrowthMeasurement, Prisma } from '@prisma/client';
import { ChildSex, toChildSex } from '../child/child-sex.enum';
import { ageInDaysAt } from '../common/age/age-in-days';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGrowthMeasurementDto } from './dto/create-growth-measurement.dto';
import { GrowthRangeQueryDto } from './dto/growth-range-query.dto';
import { UpdateGrowthMeasurementDto } from './dto/update-growth-measurement.dto';
import { MEASUREMENT_VALUE_FIELDS } from './growth-measurement.constants';
import {
  LengthMeasurementPosition,
  toLengthMeasurementPosition,
} from './length-measurement-position.enum';
import {
  BodyMeasureReference,
  GrowthIndicator,
  WHO_PERCENTILE_Z_SCORES,
  WhoPercentileBand,
  computeGrowthPercentile,
  lmsPointForIndicator,
  resolveBodyMeasureReference,
  valueFromZScore,
} from './percentiles/growth-percentiles';
import {
  LENGTH_TO_HEIGHT_BOUNDARY_DAYS,
  REFERENCE_MAX_AGE_DAYS,
  REFERENCE_MIN_AGE_DAYS,
} from './reference-data';

/**
 * Per-value classification as returned by the API. Structurally the pure
 * module's outcome minus `referenceUsed`, which is reported once per
 * measurement (`lengthOrHeightReferenceUsed`) rather than repeated per value.
 */
export type GrowthPercentileUnavailableReason =
  'CHILD_SEX_NOT_SET' | 'AGE_BELOW_REFERENCE_RANGE' | 'AGE_ABOVE_REFERENCE_RANGE';

export type GrowthPercentile =
  | { status: 'COMPUTED'; zScore: number; percentile: number }
  | { status: 'UNAVAILABLE'; reason: GrowthPercentileUnavailableReason };

export interface GrowthMeasurementSummary {
  id: string;
  childId: string;
  userId: string;
  measuredAt: Date;
  /** Completed days between the child's birth date and `measuredAt`. */
  ageInDaysAtMeasurement: number;
  weightGrams: number | null;
  lengthMillimeters: number | null;
  headCircumferenceMillimeters: number | null;
  /** The stored manual override; null means "derive from age" (W-17/W-18). */
  lengthMeasurementPosition: LengthMeasurementPosition | null;
  /**
   * The override if set, otherwise the age-derived choice — i.e. the method
   * actually attributed to this measurement (W-19). Null when the measurement
   * carries no body-measure value at all, since there is nothing to attribute.
   */
  effectiveLengthMeasurementPosition: LengthMeasurementPosition | null;
  /** Which WHO reference the length/height value was scored against (W-19). */
  lengthOrHeightReferenceUsed: BodyMeasureReference | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  percentiles: {
    weight: GrowthPercentile | null;
    length: GrowthPercentile | null;
    headCircumference: GrowthPercentile | null;
  };
}

/** One percentile curve of the reference-band response (W-12). */
export interface GrowthReferenceCurve {
  percentile: WhoPercentileBand;
  zScore: number;
  points: { ageInDays: number; value: number }[];
}

export type GrowthReferenceResponse =
  | {
      indicator: GrowthIndicator;
      sex: null;
      available: false;
      reason: 'CHILD_SEX_NOT_SET';
    }
  | {
      indicator: GrowthIndicator;
      sex: ChildSex;
      available: true;
      xUnit: 'DAYS';
      unit: 'GRAMS' | 'MILLIMETERS';
      ageRangeDays: [number, number];
      stepDays: number;
      lengthToHeightBoundaryDays: number;
      curves: GrowthReferenceCurve[];
    };

/**
 * Age-axis resolution of the reference bands. One sample per week keeps the
 * payload small (262 points per curve over five years) while staying visually
 * smooth at any realistic chart width; the curves are monotone and shallow, so
 * a finer grid would not be distinguishable on screen.
 */
export const REFERENCE_BAND_STEP_DAYS = 7;

const PERCENTILE_BANDS = Object.keys(WHO_PERCENTILE_Z_SCORES)
  .map(Number)
  .sort((a, b) => a - b) as WhoPercentileBand[];

/** Which summary percentile slot each stored value feeds. */
const VALUE_TO_INDICATOR: Record<
  (typeof MEASUREMENT_VALUE_FIELDS)[number],
  { indicator: GrowthIndicator; slot: keyof GrowthMeasurementSummary['percentiles'] }
> = {
  weightGrams: { indicator: 'WEIGHT_FOR_AGE', slot: 'weight' },
  lengthMillimeters: { indicator: 'LENGTH_OR_HEIGHT_FOR_AGE', slot: 'length' },
  headCircumferenceMillimeters: {
    indicator: 'HEAD_CIRCUMFERENCE_FOR_AGE',
    slot: 'headCircumference',
  },
};

/**
 * CRUD for growth measurements plus the WHO reference bands, scoped to a
 * household's child.
 *
 * Scoping discipline mirrors `FeedingService`: every lookup filters by
 * `childId` (and the child by `householdId`), so a measurement belonging to a
 * different child/household is indistinguishable from a nonexistent one — the
 * caller only ever sees a 404.
 *
 * Deliberately **not** wired to `RealtimeService` and with no offline/optimistic
 * path: growth tracking is online-only (W-16). A save either succeeds against
 * the server or visibly fails; nothing is buffered and no success state is
 * faked.
 */
@Injectable()
export class GrowthService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    householdId: string,
    childId: string,
    userId: string,
    dto: CreateGrowthMeasurementDto,
  ): Promise<GrowthMeasurementSummary> {
    const child = await this.findChildOrThrow(householdId, childId);
    const measuredAt = new Date(dto.measuredAt);
    assertNotBeforeBirth(measuredAt, child);

    const measurement = await this.prisma.growthMeasurement.create({
      data: {
        childId,
        // W-7: the recording user is part of the record, like Event.userId.
        userId,
        measuredAt,
        // W-3: integers in base units, passed through untouched.
        weightGrams: dto.weightGrams ?? null,
        lengthMillimeters: dto.lengthMillimeters ?? null,
        headCircumferenceMillimeters: dto.headCircumferenceMillimeters ?? null,
        lengthMeasurementPosition: dto.lengthMeasurementPosition ?? null,
        note: dto.note ?? null,
      },
    });

    return toGrowthMeasurementSummary(measurement, child);
  }

  async list(
    householdId: string,
    childId: string,
    range: GrowthRangeQueryDto = {},
  ): Promise<GrowthMeasurementSummary[]> {
    const child = await this.findChildOrThrow(householdId, childId);

    const measuredAt: Prisma.DateTimeFilter = {};
    if (range.from) {
      measuredAt.gte = new Date(range.from);
    }
    if (range.to) {
      measuredAt.lt = new Date(range.to);
    }

    const measurements = await this.prisma.growthMeasurement.findMany({
      where: {
        childId,
        ...(Object.keys(measuredAt).length > 0 ? { measuredAt } : {}),
      },
      orderBy: { measuredAt: 'asc' },
    });

    return measurements.map((measurement) => toGrowthMeasurementSummary(measurement, child));
  }

  async findOne(
    householdId: string,
    childId: string,
    measurementId: string,
  ): Promise<GrowthMeasurementSummary> {
    const { measurement, child } = await this.findMeasurementOrThrow(
      householdId,
      childId,
      measurementId,
    );
    return toGrowthMeasurementSummary(measurement, child);
  }

  async update(
    householdId: string,
    childId: string,
    measurementId: string,
    dto: UpdateGrowthMeasurementDto,
  ): Promise<GrowthMeasurementSummary> {
    const { measurement, child } = await this.findMeasurementOrThrow(
      householdId,
      childId,
      measurementId,
    );

    const data: Prisma.GrowthMeasurementUpdateInput = {};
    if (dto.measuredAt !== undefined) {
      data.measuredAt = new Date(dto.measuredAt);
    }
    if (dto.weightGrams !== undefined) {
      data.weightGrams = dto.weightGrams;
    }
    if (dto.lengthMillimeters !== undefined) {
      data.lengthMillimeters = dto.lengthMillimeters;
    }
    if (dto.headCircumferenceMillimeters !== undefined) {
      data.headCircumferenceMillimeters = dto.headCircumferenceMillimeters;
    }
    if (dto.lengthMeasurementPosition !== undefined) {
      data.lengthMeasurementPosition = dto.lengthMeasurementPosition;
    }
    if (dto.note !== undefined) {
      data.note = dto.note;
    }

    // W-1 and W-5 can only be judged on the merged result: a PATCH sees
    // neither the fields it omits nor the child it belongs to.
    const merged = { ...measurement, ...data } as GrowthMeasurement;
    if (MEASUREMENT_VALUE_FIELDS.every((field) => merged[field] === null)) {
      throw new BadRequestException(
        'A growth measurement must keep at least one of weight, length or head circumference',
      );
    }
    assertNotBeforeBirth(merged.measuredAt, child);

    const updated = await this.prisma.growthMeasurement.update({
      where: { id: measurementId },
      data,
    });

    return toGrowthMeasurementSummary(updated, child);
  }

  /** Hard delete — growth measurements have no soft-delete state (W-8). */
  async remove(householdId: string, childId: string, measurementId: string): Promise<void> {
    await this.findMeasurementOrThrow(householdId, childId, measurementId);
    await this.prisma.growthMeasurement.delete({ where: { id: measurementId } });
  }

  /**
   * The WHO percentile curves for one indicator, ready to be drawn as
   * background bands (W-12).
   *
   * Without a sex on the child profile the reference is genuinely undefined,
   * so the endpoint reports that explicitly instead of returning a
   * sex-neutral approximation (W-10).
   */
  async getReference(
    householdId: string,
    childId: string,
    indicator: GrowthIndicator,
  ): Promise<GrowthReferenceResponse> {
    const child = await this.findChildOrThrow(householdId, childId);

    if (child.sex === null) {
      return { indicator, sex: null, available: false, reason: 'CHILD_SEX_NOT_SET' };
    }
    const sex = toChildSex(child.sex);

    const sampleAges = buildSampleAges();
    const curves: GrowthReferenceCurve[] = PERCENTILE_BANDS.map((percentile) => {
      const zScore = WHO_PERCENTILE_Z_SCORES[percentile];
      return {
        percentile,
        zScore,
        points: sampleAges.map((ageInDays) => {
          // Same nearest-grid-point lookup the percentile computation uses, so
          // a measurement plotted on a band lands exactly where its percentile
          // says it should. The body measure auto-switches tables at the
          // boundary, since bands are drawn for the age axis, not for one
          // measurement's override.
          const { point, baseUnitsPerTableUnit } = lmsPointForIndicator({
            indicator,
            sex,
            ageInDays,
          });
          return {
            ageInDays,
            value: Math.round(valueFromZScore(zScore, point) * baseUnitsPerTableUnit),
          };
        }),
      };
    });

    return {
      indicator,
      sex,
      available: true,
      xUnit: 'DAYS',
      unit: indicator === 'WEIGHT_FOR_AGE' ? 'GRAMS' : 'MILLIMETERS',
      ageRangeDays: [REFERENCE_MIN_AGE_DAYS, REFERENCE_MAX_AGE_DAYS],
      stepDays: REFERENCE_BAND_STEP_DAYS,
      lengthToHeightBoundaryDays: LENGTH_TO_HEIGHT_BOUNDARY_DAYS,
      curves,
    };
  }

  private async findChildOrThrow(householdId: string, childId: string): Promise<Child> {
    const child = await this.prisma.child.findUnique({ where: { id: childId, householdId } });
    if (!child) {
      throw new NotFoundException();
    }
    return child;
  }

  private async findMeasurementOrThrow(
    householdId: string,
    childId: string,
    measurementId: string,
  ): Promise<{ measurement: GrowthMeasurement; child: Child }> {
    const child = await this.findChildOrThrow(householdId, childId);
    const measurement = await this.prisma.growthMeasurement.findUnique({
      where: { id: measurementId, childId },
    });
    if (!measurement) {
      throw new NotFoundException();
    }
    return { measurement, child };
  }
}

/** The UTC calendar day a stored date falls on, as `YYYY-MM-DD`. */
function toCalendarDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * W-5: a measurement can never predate the child it belongs to.
 *
 * Compared as calendar days, not instants: both columns hold a *day* stored as
 * UTC midnight (`measuredAt` is sent as `YYYY-MM-DD`, `birthDate` the same way
 * — see `IsDateOnly`), so an instant comparison would only differ if a legacy
 * row carried a time-of-day, and would then wrongly reject a measurement taken
 * on the birth date itself.
 */
function assertNotBeforeBirth(measuredAt: Date, child: Child): void {
  if (toCalendarDay(measuredAt) < toCalendarDay(child.birthDate)) {
    throw new BadRequestException('measuredAt must not be before the child birth date');
  }
}

/** The age grid the reference bands are sampled on, always including the end. */
function buildSampleAges(): number[] {
  const ages: number[] = [];
  for (
    let ageInDays = REFERENCE_MIN_AGE_DAYS;
    ageInDays <= REFERENCE_MAX_AGE_DAYS;
    ageInDays += REFERENCE_BAND_STEP_DAYS
  ) {
    ages.push(ageInDays);
  }
  if (ages[ages.length - 1] !== REFERENCE_MAX_AGE_DAYS) {
    ages.push(REFERENCE_MAX_AGE_DAYS);
  }
  return ages;
}

/**
 * Maps a stored measurement plus its child onto the API shape, computing the
 * derived age, percentiles and measurement method on the fly.
 *
 * Exported so the raw-data export can reuse the exact same numbers rather than
 * recomputing them slightly differently (see `ExportService`).
 */
export function toGrowthMeasurementSummary(
  measurement: GrowthMeasurement,
  child: Child,
): GrowthMeasurementSummary {
  const ageInDaysAtMeasurement = ageInDaysAt(child.birthDate, measurement.measuredAt);
  const sex = child.sex ? toChildSex(child.sex) : null;
  const positionOverride = measurement.lengthMeasurementPosition
    ? toLengthMeasurementPosition(measurement.lengthMeasurementPosition)
    : null;

  const percentiles: GrowthMeasurementSummary['percentiles'] = {
    weight: null,
    length: null,
    headCircumference: null,
  };
  for (const field of MEASUREMENT_VALUE_FIELDS) {
    const value = measurement[field];
    if (value === null) {
      continue;
    }
    const { indicator, slot } = VALUE_TO_INDICATOR[field];
    percentiles[slot] = stripReferenceUsed(
      computeGrowthPercentile({
        indicator,
        sex,
        ageInDays: ageInDaysAtMeasurement,
        valueInBaseUnit: value,
        bodyMeasurePositionOverride: positionOverride,
      }),
    );
  }

  const hasBodyMeasure = measurement.lengthMillimeters !== null;
  const referenceUsed = hasBodyMeasure
    ? resolveBodyMeasureReference(ageInDaysAtMeasurement, positionOverride)
    : null;

  return {
    id: measurement.id,
    childId: measurement.childId,
    userId: measurement.userId,
    measuredAt: measurement.measuredAt,
    ageInDaysAtMeasurement,
    weightGrams: measurement.weightGrams,
    lengthMillimeters: measurement.lengthMillimeters,
    headCircumferenceMillimeters: measurement.headCircumferenceMillimeters,
    lengthMeasurementPosition: positionOverride,
    effectiveLengthMeasurementPosition:
      referenceUsed === null
        ? null
        : referenceUsed === 'LENGTH'
          ? LengthMeasurementPosition.LYING
          : LengthMeasurementPosition.STANDING,
    lengthOrHeightReferenceUsed: referenceUsed,
    note: measurement.note,
    createdAt: measurement.createdAt,
    updatedAt: measurement.updatedAt,
    percentiles,
  };
}

/**
 * `referenceUsed` is a property of the measurement, not of each value, so it
 * is surfaced once at the top level instead of being repeated inside all three
 * percentile slots.
 */
function stripReferenceUsed(outcome: ReturnType<typeof computeGrowthPercentile>): GrowthPercentile {
  if (outcome.status === 'UNAVAILABLE') {
    return outcome;
  }
  return { status: 'COMPUTED', zScore: outcome.zScore, percentile: outcome.percentile };
}
