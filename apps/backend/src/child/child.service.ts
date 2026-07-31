import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Child, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChildPhotoStorageService } from './child-photo-storage.service';
import { ALLOWED_PHOTO_MIME_TYPES, AllowedPhotoMimeType } from './child-photo.constants';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';

export interface ChildSummary {
  id: string;
  householdId: string;
  name: string;
  birthDate: Date;
  hasPhoto: boolean;
  createdAt: Date;
}

export interface ChildPhoto {
  buffer: Buffer;
  mimeType: string;
}

function toSummary(child: Child): ChildSummary {
  return {
    id: child.id,
    householdId: child.householdId,
    name: child.name,
    birthDate: child.birthDate,
    hasPhoto: child.photoPath !== null,
    createdAt: child.createdAt,
  };
}

/**
 * Validates+narrows an uploaded file's `mimetype` into `AllowedPhotoMimeType`.
 * Should be unreachable in practice — `ChildController`'s
 * `ParseFilePipeBuilder` already rejects any other mime type before this is
 * called — but this is the defensive application-layer boundary, mirroring
 * `toHouseholdRole()` in `household-role.enum.ts`.
 */
function toAllowedMimeType(mimeType: string): AllowedPhotoMimeType {
  if ((ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return mimeType as AllowedPhotoMimeType;
  }
  throw new Error(`Unexpected photo mime type: ${mimeType}`);
}

/**
 * CRUD for `Child` profiles, scoped to a household. Every lookup/update/
 * delete query filters by `where: { id, householdId }` so a child from a
 * different household is indistinguishable from a nonexistent one — the
 * caller (`ChildController`, guarded by `HouseholdMembershipGuard`) never
 * sees a 403 for this, only a 404. See ADR-0003 for the photo storage
 * design and the ordered write/commit/cleanup sequences implemented below.
 */
@Injectable()
export class ChildService {
  private readonly logger = new Logger(ChildService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly photoStorage: ChildPhotoStorageService,
  ) {}

  async create(
    householdId: string,
    dto: CreateChildDto,
    photo?: Express.Multer.File,
  ): Promise<ChildSummary> {
    // The Child's id is normally left to Prisma's `@default(cuid())`, but a
    // photo's filename must be derivable from the childId (see ADR-0003),
    // and the file must be written *before* the DB row exists (so a failed
    // write never leaves an orphaned Child row). Pre-generating the id and
    // passing it explicitly to `create` resolves that ordering constraint.
    const childId = randomUUID();

    let photoPath: string | undefined;
    let photoMimeType: AllowedPhotoMimeType | undefined;

    if (photo) {
      photoMimeType = toAllowedMimeType(photo.mimetype);
      photoPath = await this.photoStorage.save(childId, photoMimeType, photo.buffer);
    }

    try {
      const child = await this.prisma.child.create({
        data: {
          id: childId,
          householdId,
          name: dto.name,
          birthDate: new Date(dto.birthDate),
          photoPath,
          photoMimeType,
        },
      });
      return toSummary(child);
    } catch (error) {
      if (photoPath) {
        // The file write succeeded but the DB create didn't — the file is
        // now an orphan. Orphan sweeping is explicitly out of scope for
        // this sub-step (see ADR-0003).
        this.logger.warn(
          `Child create failed after photo write succeeded; orphaned file at "${photoPath}" (childId=${childId})`,
        );
      }
      throw error;
    }
  }

  async list(householdId: string): Promise<ChildSummary[]> {
    const children = await this.prisma.child.findMany({ where: { householdId } });
    return children.map(toSummary);
  }

  async findOne(householdId: string, childId: string): Promise<ChildSummary> {
    const child = await this.findChildOrThrow(householdId, childId);
    return toSummary(child);
  }

  async update(
    householdId: string,
    childId: string,
    dto: UpdateChildDto,
    photo?: Express.Multer.File,
  ): Promise<ChildSummary> {
    const existing = await this.findChildOrThrow(householdId, childId);

    const data: Prisma.ChildUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.birthDate !== undefined) {
      data.birthDate = new Date(dto.birthDate);
    }

    let newPhotoPath: string | undefined;
    if (photo) {
      const mimeType = toAllowedMimeType(photo.mimetype);
      // Step 1: write the new file first, under a fresh unique name. If
      // this throws, abort immediately — no DB write attempted, the
      // existing photo (if any) remains valid and unchanged.
      newPhotoPath = await this.photoStorage.save(childId, mimeType, photo.buffer);
      data.photoPath = newPhotoPath;
      data.photoMimeType = mimeType;
    }

    let updated: Child;
    try {
      // Step 2: only after the disk write succeeds, update the Child row.
      updated = await this.prisma.child.update({
        where: { id: childId, householdId },
        data,
      });
    } catch (error) {
      if (newPhotoPath) {
        // Step 3: the DB update failed after the file write succeeded — the
        // new file is now an orphan. The old file and old DB row are
        // untouched, so the child's photo reference stays valid throughout.
        this.logger.warn(
          `Child update failed after photo write succeeded; orphaned file at "${newPhotoPath}" (childId=${childId})`,
        );
      }
      throw error;
    }

    if (newPhotoPath && existing.photoPath) {
      // Step 4: only after the DB update commits, delete the old file.
      // Best-effort — a failure here must not fail the request, since the
      // DB already correctly points at the new photo.
      await this.photoStorage.delete(existing.photoPath);
    }

    return toSummary(updated);
  }

  async remove(householdId: string, childId: string): Promise<void> {
    const child = await this.findChildOrThrow(householdId, childId);

    // Step 1: delete the DB row first — this is the authoritative state
    // change; once committed, GET on this childId already 404s regardless
    // of disk state.
    await this.prisma.child.delete({ where: { id: childId, householdId } });

    if (child.photoPath) {
      // Step 2: best-effort cleanup of the photo file.
      await this.photoStorage.delete(child.photoPath);
    }
  }

  async getPhoto(householdId: string, childId: string): Promise<ChildPhoto> {
    const child = await this.findChildOrThrow(householdId, childId);

    if (!child.photoPath || !child.photoMimeType) {
      throw new NotFoundException();
    }

    const buffer = await this.photoStorage.read(child.photoPath);
    if (!buffer) {
      // Set `photoPath` but no backing file on disk — treat as a normal
      // 404 (indistinguishable from "no photo" to the caller), but log
      // server-side since it indicates drift that's worth investigating.
      this.logger.warn(
        `Child ${childId} has photoPath "${child.photoPath}" set but the file is missing on disk`,
      );
      throw new NotFoundException();
    }

    return { buffer, mimeType: child.photoMimeType };
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
