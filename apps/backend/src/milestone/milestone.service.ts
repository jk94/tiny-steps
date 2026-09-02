import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Child, Milestone, MilestonePhoto, Prisma } from '@prisma/client';
import { ageInDaysAt } from '../common/age/age-in-days';
import { ageInMonthsAt } from '../common/age/age-in-months';
import { toAllowedPhotoMimeType } from '../common/photo/photo-upload';
import { MAX_PHOTOS_PER_MILESTONE } from '../common/photo/photo.constants';
import { PrismaService } from '../prisma/prisma.service';
import { MilestonePhotoStorageService } from './milestone-photo-storage.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { MilestoneRangeQueryDto } from './dto/milestone-range-query.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { getMilestoneCatalogEntry } from './milestone-catalog';
import { MilestoneCategory, toMilestoneCategory } from './milestone-category.enum';
import { MilestoneTemplate, toMilestoneTemplate } from './milestone-template.enum';

/** Prisma error code for a unique-constraint violation. */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * A milestone photo as clients see it. The stored `path` is deliberately
 * absent — it never leaves the server (M-8, ADR-0003); a client addresses a
 * photo by its id through the authenticated serve endpoint.
 */
export interface MilestonePhotoRef {
  id: string;
  sortIndex: number;
  mimeType: string;
}

/**
 * One milestone as the API returns it.
 *
 * Timestamps are ISO-8601 strings rather than `Date` objects so the shape
 * serializes identically wherever it is reused.
 */
export interface MilestoneSummary {
  id: string;
  childId: string;
  userId: string;
  /** `null` for a free entry (M-4). */
  templateKey: MilestoneTemplate | null;
  /** Always set; frozen at creation time — see `schema.prisma`. */
  title: string;
  category: MilestoneCategory | null;
  /** The calendar day, as a UTC-midnight ISO instant. */
  achievedAt: string;
  /** Completed days between the child's birth date and `achievedAt`. */
  ageInDaysAtMilestone: number;
  /** The same age in whole months — what the UI actually prints (M-6). */
  ageInMonthsAtMilestone: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  /** Ordered by `sortIndex`, so the gallery never reshuffles (M-10). */
  photos: MilestonePhotoRef[];
}

/**
 * CRUD for developmental milestones, scoped to a household's child.
 *
 * Scoping discipline mirrors `GrowthService`: every lookup filters by
 * `childId` (and the child by `householdId`), so a milestone belonging to a
 * different child/household is indistinguishable from a nonexistent one — the
 * caller only ever sees a 404.
 *
 * Deliberately **not** wired to `RealtimeService` and with no offline/
 * optimistic path: milestones are online-only (M-15). A save either succeeds
 * against the server or visibly fails; nothing is buffered and no success
 * state is faked — least of all a photo upload.
 */
@Injectable()
export class MilestoneService {
  private readonly logger = new Logger(MilestoneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly photoStorage: MilestonePhotoStorageService,
  ) {}

  async create(
    householdId: string,
    childId: string,
    userId: string,
    dto: CreateMilestoneDto,
  ): Promise<MilestoneSummary> {
    const child = await this.findChildOrThrow(householdId, childId);
    const achievedAt = new Date(dto.achievedAt);
    assertNotBeforeBirth(achievedAt, child);

    // A template entry's category comes from the catalog, never from the
    // client (the DTO already rejects a client-sent one); a free entry keeps
    // whatever the user picked, if anything.
    const templateKey = dto.templateKey ? toMilestoneTemplate(dto.templateKey) : null;
    const category = templateKey
      ? getMilestoneCatalogEntry(templateKey).category
      : (dto.category ?? null);

    let milestone: Milestone;
    try {
      milestone = await this.prisma.milestone.create({
        data: {
          childId,
          // M-14: the recording user is part of the record, like Event.userId.
          userId,
          templateKey,
          title: dto.title,
          category,
          achievedAt,
          note: dto.note ?? null,
        },
      });
    } catch (error) {
      if (isTemplateAlreadyRecorded(error)) {
        // M-5 enforced by the DB's unique index. Surfaced as a friendly,
        // machine-readable conflict so the UI can offer to open the existing
        // entry instead of repeating a raw Prisma error.
        throw new ConflictException({
          statusCode: 409,
          code: 'MILESTONE_TEMPLATE_ALREADY_RECORDED',
          message: 'This milestone template has already been recorded for this child',
        });
      }
      throw error;
    }

    return toMilestoneSummary(milestone, child, []);
  }

  /** Newest first — the timeline reads backwards through time (M-11). */
  async list(
    householdId: string,
    childId: string,
    range: MilestoneRangeQueryDto = {},
  ): Promise<MilestoneSummary[]> {
    const child = await this.findChildOrThrow(householdId, childId);

    const achievedAt: Prisma.DateTimeFilter = {};
    if (range.from) {
      achievedAt.gte = new Date(range.from);
    }
    if (range.to) {
      achievedAt.lt = new Date(range.to);
    }

    const milestones = await this.prisma.milestone.findMany({
      where: {
        childId,
        ...(Object.keys(achievedAt).length > 0 ? { achievedAt } : {}),
      },
      include: { photos: { orderBy: { sortIndex: 'asc' } } },
      orderBy: { achievedAt: 'desc' },
    });

    return milestones.map((milestone) => toMilestoneSummary(milestone, child, milestone.photos));
  }

  async findOne(
    householdId: string,
    childId: string,
    milestoneId: string,
  ): Promise<MilestoneSummary> {
    const { milestone, child } = await this.findMilestoneOrThrow(householdId, childId, milestoneId);
    return toMilestoneSummary(milestone, child, milestone.photos);
  }

  async update(
    householdId: string,
    childId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
  ): Promise<MilestoneSummary> {
    const { milestone, child } = await this.findMilestoneOrThrow(householdId, childId, milestoneId);

    const isTemplateEntry = milestone.templateKey !== null;
    if (isTemplateEntry && (dto.title !== undefined || dto.category !== undefined)) {
      // Both are owned by the catalog for a template entry: the title was
      // frozen from the catalog label at creation and the category is derived
      // from the key. Rejecting is deliberate — silently ignoring the change
      // would let the client believe it took effect.
      throw new BadRequestException({
        statusCode: 400,
        code: 'MILESTONE_TEMPLATE_FIELD_NOT_EDITABLE',
        message: 'title and category cannot be changed on a template milestone',
      });
    }

    const data: Prisma.MilestoneUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.category !== undefined) {
      data.category = dto.category;
    }
    if (dto.achievedAt !== undefined) {
      data.achievedAt = new Date(dto.achievedAt);
    }
    if (dto.note !== undefined) {
      data.note = dto.note;
    }

    // M-6 can only be judged on the merged result: a PATCH that leaves
    // `achievedAt` alone must still be checked against the stored value.
    assertNotBeforeBirth(
      dto.achievedAt !== undefined ? new Date(dto.achievedAt) : milestone.achievedAt,
      child,
    );

    const updated = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data,
      include: { photos: { orderBy: { sortIndex: 'asc' } } },
    });

    return toMilestoneSummary(updated, child, updated.photos);
  }

  /**
   * Hard delete. The photo rows go with the milestone through the FK cascade;
   * the files on disk are then removed best-effort (M-9) — the DB is the
   * authoritative state, so a filesystem error is logged and swallowed rather
   * than failing an operation that has already committed. Same ordering as
   * `ChildService.remove()`.
   */
  async remove(householdId: string, childId: string, milestoneId: string): Promise<void> {
    const { milestone } = await this.findMilestoneOrThrow(householdId, childId, milestoneId);

    await this.prisma.milestone.delete({ where: { id: milestoneId } });

    for (const photo of milestone.photos) {
      // `photoStorage.delete()` already swallows filesystem errors, but this
      // is a loop: one unexpected rejection must not skip the remaining files,
      // and must never turn an already-committed delete into a failed request
      // (M-9).
      await this.photoStorage.delete(photo.path).catch((error: unknown) => {
        this.logger.warn(
          `Failed to delete milestone photo file "${photo.path}" (milestoneId=${milestoneId}): ${String(error)}`,
        );
      });
    }
  }

  /**
   * Appends one photo to a milestone (M-7).
   *
   * The file is written *before* the DB row is created, so a failed write
   * never leaves a `MilestonePhoto` row pointing at nothing. The reverse case
   * — write succeeds, insert fails — leaves an orphaned file, which is logged;
   * orphan sweeping stays out of scope, exactly as in ADR-0003.
   */
  async addPhoto(
    householdId: string,
    childId: string,
    milestoneId: string,
    photo: Express.Multer.File,
  ): Promise<MilestonePhotoRef> {
    const { milestone } = await this.findMilestoneOrThrow(householdId, childId, milestoneId);

    if (milestone.photos.length >= MAX_PHOTOS_PER_MILESTONE) {
      throw new ConflictException({
        statusCode: 409,
        code: 'MILESTONE_PHOTO_LIMIT_REACHED',
        message: `A milestone can carry at most ${MAX_PHOTOS_PER_MILESTONE} photos`,
      });
    }

    const mimeType = toAllowedPhotoMimeType(photo.mimetype);
    // M-10: "current maximum + 1" rather than the row count, so deleting a
    // photo from the middle can never make a later upload collide with an
    // existing index.
    const sortIndex =
      milestone.photos.reduce((max, existing) => Math.max(max, existing.sortIndex), -1) + 1;

    const path = await this.photoStorage.save(milestoneId, mimeType, photo.buffer);

    try {
      const created = await this.prisma.milestonePhoto.create({
        data: { milestoneId, path, mimeType, sortIndex },
      });
      return { id: created.id, sortIndex: created.sortIndex, mimeType: created.mimeType };
    } catch (error) {
      this.logger.warn(
        `Milestone photo insert failed after the file write succeeded; orphaned file at "${path}" (milestoneId=${milestoneId})`,
      );
      throw error;
    }
  }

  /**
   * Serves one photo's bytes (M-8). Buffers the whole (<=2MB) file into memory
   * rather than streaming, so an async ENOENT after headers are already sent
   * can't happen — same reasoning as `ChildService.getPhoto()`.
   */
  async getPhoto(
    householdId: string,
    childId: string,
    milestoneId: string,
    photoId: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const photo = await this.findPhotoOrThrow(householdId, childId, milestoneId, photoId);

    const buffer = await this.photoStorage.read(photo.path);
    if (!buffer) {
      // A stored row with no backing file — a normal 404 to the caller
      // (indistinguishable from "no such photo"), but logged server-side since
      // it indicates drift worth investigating.
      this.logger.warn(
        `Milestone photo ${photoId} has path "${photo.path}" set but the file is missing on disk`,
      );
      throw new NotFoundException();
    }

    return { buffer, mimeType: photo.mimeType };
  }

  /**
   * Removes a single photo (M-9). The DB row goes first — that is the
   * authoritative state change — and the file is then deleted best-effort.
   */
  async removePhoto(
    householdId: string,
    childId: string,
    milestoneId: string,
    photoId: string,
  ): Promise<void> {
    const photo = await this.findPhotoOrThrow(householdId, childId, milestoneId, photoId);

    await this.prisma.milestonePhoto.delete({ where: { id: photoId } });
    await this.photoStorage.delete(photo.path);
  }

  private async findChildOrThrow(householdId: string, childId: string): Promise<Child> {
    const child = await this.prisma.child.findUnique({ where: { id: childId, householdId } });
    if (!child) {
      throw new NotFoundException();
    }
    return child;
  }

  private async findMilestoneOrThrow(
    householdId: string,
    childId: string,
    milestoneId: string,
  ): Promise<{ milestone: Milestone & { photos: MilestonePhoto[] }; child: Child }> {
    const child = await this.findChildOrThrow(householdId, childId);
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId, childId },
      include: { photos: { orderBy: { sortIndex: 'asc' } } },
    });
    if (!milestone) {
      throw new NotFoundException();
    }
    return { milestone, child };
  }

  /**
   * Resolves one photo through the full household -> child -> milestone chain,
   * so a photo id from another household is a 404 rather than a leak (M-8).
   */
  private async findPhotoOrThrow(
    householdId: string,
    childId: string,
    milestoneId: string,
    photoId: string,
  ): Promise<MilestonePhoto> {
    const { milestone } = await this.findMilestoneOrThrow(householdId, childId, milestoneId);
    const photo = milestone.photos.find((candidate) => candidate.id === photoId);
    if (!photo) {
      throw new NotFoundException();
    }
    return photo;
  }
}

/** True for the `@@unique([childId, templateKey])` violation behind M-5. */
function isTemplateAlreadyRecorded(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  );
}

/** The UTC calendar day a stored date falls on, as `YYYY-MM-DD`. */
function toCalendarDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * M-6: a milestone can never predate the child it belongs to.
 *
 * Compared as calendar days, not instants: both columns hold a *day* stored as
 * UTC midnight (`achievedAt` is sent as `YYYY-MM-DD`, `birthDate` the same way
 * — see `IsDateOnly`), so an instant comparison would only differ if a legacy
 * row carried a time-of-day, and would then wrongly reject a milestone reached
 * on the birth date itself.
 */
function assertNotBeforeBirth(achievedAt: Date, child: Child): void {
  if (toCalendarDay(achievedAt) < toCalendarDay(child.birthDate)) {
    throw new BadRequestException('achievedAt must not be before the child birth date');
  }
}

/**
 * Maps a stored milestone plus its child onto the API shape, computing the
 * derived age on the fly.
 *
 * The photo list is passed in rather than read off the milestone so callers
 * that already know there are none (a freshly created milestone) don't have to
 * fabricate an empty relation. `path` is never copied across — see
 * `MilestonePhotoRef`.
 */
export function toMilestoneSummary(
  milestone: Milestone,
  child: Child,
  photos: MilestonePhoto[],
): MilestoneSummary {
  return {
    id: milestone.id,
    childId: milestone.childId,
    userId: milestone.userId,
    templateKey: milestone.templateKey ? toMilestoneTemplate(milestone.templateKey) : null,
    title: milestone.title,
    category: milestone.category ? toMilestoneCategory(milestone.category) : null,
    achievedAt: milestone.achievedAt.toISOString(),
    ageInDaysAtMilestone: ageInDaysAt(child.birthDate, milestone.achievedAt),
    ageInMonthsAtMilestone: ageInMonthsAt(child.birthDate, milestone.achievedAt),
    note: milestone.note,
    createdAt: milestone.createdAt.toISOString(),
    updatedAt: milestone.updatedAt.toISOString(),
    photos: photos.map((photo) => ({
      id: photo.id,
      sortIndex: photo.sortIndex,
      mimeType: photo.mimeType,
    })),
  };
}
