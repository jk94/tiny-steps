import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Child, HealthRecord, Prisma } from '@prisma/client';
import { assertMayEditEntry } from '../common/authorization/assert-entry-owner';
import { MAX_UTC_OFFSET_MS } from '../common/validators/is-not-future-date.validator';
import type { HouseholdActor } from '../household/decorators/household-actor.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHealthRecordDto } from './dto/create-health-record.dto';
import { HealthRecordQueryDto } from './dto/health-record-query.dto';
import { UpdateHealthRecordDto } from './dto/update-health-record.dto';
import { HealthRecordKind, toHealthRecordKind } from './health-record-kind.enum';

/**
 * One health record as the API returns it.
 *
 * Timestamps are ISO-8601 strings rather than `Date` objects so the shape
 * serializes identically wherever it is reused. `reminderLastSentAt` is
 * deliberately absent — it is internal scheduler bookkeeping (MED-9), never
 * client-visible, mirroring how `feedingReminderLastSentAt` stays out of
 * `NotificationSettingsView`.
 */
export interface HealthRecordSummary {
  id: string;
  childId: string;
  userId: string;
  kind: HealthRecordKind;
  name: string;
  /** A real instant; `null` while the entry is only planned. */
  administeredAt: string | null;
  /** A calendar day, as a UTC-midnight ISO instant; `null` for a pure history entry. */
  dueAt: string | null;
  doseAmount: number | null;
  doseUnit: string | null;
  vaccineBatch: string | null;
  note: string | null;
  reminderEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The cross-column state every rule below is judged on. */
interface HealthRecordState {
  administeredAt: Date | null;
  dueAt: Date | null;
  doseAmount: number | null;
  doseUnit: string | null;
  vaccineBatch: string | null;
}

/**
 * CRUD for medications and vaccinations, scoped to a household's child.
 *
 * Scoping discipline mirrors `MilestoneService`: every lookup filters by
 * `childId` (and the child by `householdId`), so a record belonging to a
 * different child/household is indistinguishable from a nonexistent one — the
 * caller only ever sees a 404.
 *
 * Deliberately **not** wired to `RealtimeService` and with no offline/
 * optimistic path: health records are online-only (MED-15). A save either
 * succeeds against the server or visibly fails; nothing is buffered and no
 * success state is faked.
 */
@Injectable()
export class HealthRecordService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    householdId: string,
    childId: string,
    userId: string,
    dto: CreateHealthRecordDto,
  ): Promise<HealthRecordSummary> {
    const child = await this.findChildOrThrow(householdId, childId);

    const state: HealthRecordState = {
      administeredAt: dto.administeredAt ? new Date(dto.administeredAt) : null,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      doseAmount: dto.doseAmount ?? null,
      doseUnit: dto.doseUnit ?? null,
      vaccineBatch: dto.vaccineBatch ?? null,
    };
    assertHasDate(state);
    assertKindFieldRules(dto.kind, state);
    assertAdministeredNotBeforeBirth(state.administeredAt, child);

    const record = await this.prisma.healthRecord.create({
      data: {
        childId,
        // The recording user is part of the record, like Event.userId (MED-1).
        userId,
        kind: dto.kind,
        name: dto.name,
        ...state,
        note: dto.note ?? null,
        reminderEnabled: dto.reminderEnabled ?? false,
      },
    });

    return toHealthRecordSummary(record);
  }

  /**
   * All of a child's records, optionally narrowed by kind and/or status.
   *
   * Ordered so both of MED-12's sections come out of one query already in
   * their display order: planned entries first, by ascending due date (the
   * next appointment on top), then the history by descending administration
   * date.
   *
   * `nulls: 'last'` is what actually puts the pure history entries (`dueAt`
   * null) after the planned ones — a bare `'asc'` would sort them first on
   * SQLite and last on PostgreSQL, so the two would disagree about the whole
   * page's order.
   */
  async list(
    householdId: string,
    childId: string,
    query: HealthRecordQueryDto = {},
  ): Promise<HealthRecordSummary[]> {
    await this.findChildOrThrow(householdId, childId);

    const records = await this.prisma.healthRecord.findMany({
      where: {
        childId,
        ...(query.kind ? { kind: query.kind } : {}),
        ...statusFilter(query.status),
      },
      orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { administeredAt: 'desc' }],
    });

    return records.map(toHealthRecordSummary);
  }

  async findOne(
    householdId: string,
    childId: string,
    recordId: string,
  ): Promise<HealthRecordSummary> {
    const { record } = await this.findRecordOrThrow(householdId, childId, recordId);
    return toHealthRecordSummary(record);
  }

  /**
   * Partial edit (MED-14), and the very same path "mark as done" (MED-5) takes
   * — that action is just a PATCH carrying `administeredAt: now`.
   *
   * Every rule is re-checked against the *merged* next state, never against the
   * patch alone: a PATCH clearing the only date must fail MED-2 even though it
   * mentions one date, and a dose added to a record whose unit was stored
   * earlier must pass MED-3.
   */
  async update(
    householdId: string,
    childId: string,
    recordId: string,
    actor: HouseholdActor,
    dto: UpdateHealthRecordDto,
  ): Promise<HealthRecordSummary> {
    const { record, child } = await this.findRecordOrThrow(householdId, childId, recordId);

    // A CAREGIVER may only edit what they recorded themselves — a check the
    // route-level role annotation cannot make, since it needs the row. This
    // also gates "mark as done" (MED-5), which runs through this same PATCH.
    assertMayEditEntry(actor, record.userId);

    const next: HealthRecordState = {
      administeredAt: mergeDate(dto.administeredAt, record.administeredAt),
      dueAt: mergeDate(dto.dueAt, record.dueAt),
      doseAmount: merge(dto.doseAmount, record.doseAmount),
      doseUnit: merge(dto.doseUnit, record.doseUnit),
      vaccineBatch: merge(dto.vaccineBatch, record.vaccineBatch),
    };
    assertHasDate(next);
    // The stored kind, not a client-supplied one: `kind` is immutable, so the
    // legal column set can never be changed by the same request that fills it.
    assertKindFieldRules(toHealthRecordKind(record.kind), next);
    assertAdministeredNotBeforeBirth(next.administeredAt, child);

    const data: Prisma.HealthRecordUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.administeredAt !== undefined) data.administeredAt = next.administeredAt;
    if (dto.dueAt !== undefined) data.dueAt = next.dueAt;
    if (dto.doseAmount !== undefined) data.doseAmount = next.doseAmount;
    if (dto.doseUnit !== undefined) data.doseUnit = next.doseUnit;
    if (dto.vaccineBatch !== undefined) data.vaccineBatch = next.vaccineBatch;
    if (dto.note !== undefined) data.note = dto.note;
    if (dto.reminderEnabled !== undefined) data.reminderEnabled = dto.reminderEnabled;

    // Moving the appointment re-arms both reminder triggers: the stored
    // "already reminded" stamp refers to the OLD due date, so keeping it would
    // silently swallow the advance reminder for a date pushed further out (and,
    // for a date pulled closer, an entry that is suddenly due tomorrow).
    if (hasDueDateChanged(dto, record)) {
      data.reminderLastSentAt = null;
    }

    const updated = await this.prisma.healthRecord.update({ where: { id: recordId }, data });
    return toHealthRecordSummary(updated);
  }

  /** Hard delete (MED-14). No files and no cascade of our own — see `remove` on
   * `MilestoneService` for the photo case this deliberately does not have. */
  async remove(householdId: string, childId: string, recordId: string): Promise<void> {
    await this.findRecordOrThrow(householdId, childId, recordId);
    await this.prisma.healthRecord.delete({ where: { id: recordId } });
  }

  private async findChildOrThrow(householdId: string, childId: string): Promise<Child> {
    const child = await this.prisma.child.findUnique({ where: { id: childId, householdId } });
    if (!child) {
      throw new NotFoundException();
    }
    return child;
  }

  private async findRecordOrThrow(
    householdId: string,
    childId: string,
    recordId: string,
  ): Promise<{ record: HealthRecord; child: Child }> {
    const child = await this.findChildOrThrow(householdId, childId);
    const record = await this.prisma.healthRecord.findUnique({
      where: { id: recordId, childId },
    });
    if (!record) {
      throw new NotFoundException();
    }
    return { record, child };
  }
}

/**
 * Translates MED-12's status into a `where` fragment. Derived from
 * `administeredAt` rather than a stored status column, so the two can never
 * disagree.
 */
function statusFilter(status: HealthRecordQueryDto['status']): Prisma.HealthRecordWhereInput {
  if (status === 'planned') {
    return { administeredAt: null };
  }
  if (status === 'done') {
    return { administeredAt: { not: null } };
  }
  return {};
}

/** PATCH merge: an absent key keeps the stored value, an explicit `null` clears it. */
function merge<T>(patched: T | null | undefined, stored: T | null): T | null {
  return patched === undefined ? stored : patched;
}

function mergeDate(patched: string | null | undefined, stored: Date | null): Date | null {
  if (patched === undefined) return stored;
  return patched === null ? null : new Date(patched);
}

/** True when the PATCH actually moves the due date to a different instant. */
function hasDueDateChanged(dto: UpdateHealthRecordDto, record: HealthRecord): boolean {
  if (dto.dueAt === undefined) {
    return false;
  }
  const nextTime = dto.dueAt === null ? null : new Date(dto.dueAt).getTime();
  return nextTime !== (record.dueAt?.getTime() ?? null);
}

function badRequest(code: string, message: string): BadRequestException {
  // Structured like every other health-record error so the frontend can map it
  // to a specific message rather than the generic 400 fallback.
  return new BadRequestException({ statusCode: 400, code, message });
}

/**
 * MED-2: an entry is either something that happened, or something planned, or
 * both — but never neither. A cross-column rule SQLite cannot express, so it
 * lives here (same compromise as `FeedingDetail`, ADR-0006).
 */
function assertHasDate(state: HealthRecordState): void {
  if (state.administeredAt === null && state.dueAt === null) {
    throw badRequest('HEALTH_RECORD_MISSING_DATE', 'either administeredAt or dueAt must be set');
  }
}

/**
 * The per-`kind` field validity behind MED-3/MED-4.
 *
 * A field belonging to the other kind is rejected rather than silently dropped:
 * ignoring it would let a client believe a dose was recorded when nothing was
 * stored.
 */
function assertKindFieldRules(kind: HealthRecordKind, state: HealthRecordState): void {
  if (
    kind === HealthRecordKind.VACCINATION &&
    (state.doseAmount !== null || state.doseUnit !== null)
  ) {
    throw badRequest(
      'HEALTH_RECORD_FIELD_NOT_ALLOWED_FOR_KIND',
      'dose fields are only valid for a medication',
    );
  }
  if (kind === HealthRecordKind.MEDICATION && state.vaccineBatch !== null) {
    throw badRequest(
      'HEALTH_RECORD_FIELD_NOT_ALLOWED_FOR_KIND',
      'vaccineBatch is only valid for a vaccination',
    );
  }
  // MED-3: both are optional, but a bare number is not a dose — "5" of what?
  // The reverse (a unit with no amount) stays allowed: it is merely incomplete,
  // not ambiguous.
  if (state.doseAmount !== null && state.doseUnit === null) {
    throw badRequest('HEALTH_RECORD_DOSE_UNIT_REQUIRED', 'doseAmount requires doseUnit');
  }
}

/**
 * MED-6: a dose can never have been given before the child existed.
 *
 * Compared on calendar days like `MilestoneService`'s `assertNotBeforeBirth`,
 * but with a tolerance the milestone check does not need: `achievedAt` is a
 * bare calendar day, whereas `administeredAt` is a real instant. `birthDate` is
 * stored as UTC midnight, so a plain instant (or plain UTC-day) comparison
 * rejects a legitimate administration made early on the birth day itself by
 * anyone east of UTC — 2 h of that day in Berlin, 13 h in Auckland — while the
 * client only ever pre-checks the *local* calendar day, so the two disagree.
 *
 * Shifting the instant forward by `MAX_UTC_OFFSET_MS` (the same slack
 * `IsNotFutureDate` applies to date-only values) makes the rule "reject only
 * once this instant precedes the birth day everywhere on Earth". The cost is up
 * to that much slack on the day before birth, which is the harmless direction
 * and which the form's own calendar-day check already covers.
 */
function assertAdministeredNotBeforeBirth(administeredAt: Date | null, child: Child): void {
  if (
    administeredAt !== null &&
    toCalendarDay(new Date(administeredAt.getTime() + MAX_UTC_OFFSET_MS)) <
      toCalendarDay(child.birthDate)
  ) {
    // Reachable whenever the client's cached `birthDate` is stale (e.g.
    // corrected on another device), so the form's own pre-check can miss.
    throw badRequest(
      'HEALTH_RECORD_ADMINISTERED_AT_BEFORE_BIRTH',
      'administeredAt must not be before the child birth date',
    );
  }
}

/** The UTC calendar day a date falls on, as `YYYY-MM-DD`. */
function toCalendarDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Maps a stored row onto the API shape, dropping the internal reminder stamp. */
export function toHealthRecordSummary(record: HealthRecord): HealthRecordSummary {
  return {
    id: record.id,
    childId: record.childId,
    userId: record.userId,
    kind: toHealthRecordKind(record.kind),
    name: record.name,
    administeredAt: record.administeredAt?.toISOString() ?? null,
    dueAt: record.dueAt?.toISOString() ?? null,
    doseAmount: record.doseAmount,
    doseUnit: record.doseUnit,
    vaccineBatch: record.vaccineBatch,
    note: record.note,
    reminderEnabled: record.reminderEnabled,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
