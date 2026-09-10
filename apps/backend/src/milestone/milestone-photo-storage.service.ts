import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import type { AllowedPhotoMimeType } from '../common/photo/photo.constants';
import { PHOTO_MIME_TYPE_TO_EXTENSION } from '../common/photo/photo.constants';
import { resolveUploadsDir } from '../config/uploads-dir';

const MILESTONES_SUBDIR = 'milestones';

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

/**
 * Reads/writes milestone photo files on local disk, under
 * `<resolveUploadsDir()>/milestones/`. Mirrors `ChildPhotoStorageService`
 * exactly — same ADR-0003 design, a separate subdirectory and a separate
 * service so the two domains' files never collide and either could later move
 * independently.
 *
 * Every write happens under a fresh, unguessable filename; files are never
 * overwritten in place, which is what makes the ordered write-then-commit
 * sequence in `MilestoneService` safe.
 */
@Injectable()
export class MilestonePhotoStorageService {
  private readonly logger = new Logger(MilestonePhotoStorageService.name);

  /**
   * Writes `buffer` to disk and returns the path to store on
   * `MilestonePhoto.path`, relative to `resolveUploadsDir()` (e.g.
   * `milestones/<milestoneId>-<uuid>.jpg`). The extension is derived solely
   * from the already-validated `mimeType`, never from client input.
   */
  async save(milestoneId: string, mimeType: AllowedPhotoMimeType, buffer: Buffer): Promise<string> {
    const dir = join(resolveUploadsDir(), MILESTONES_SUBDIR);
    await mkdir(dir, { recursive: true });

    const extension = PHOTO_MIME_TYPE_TO_EXTENSION[mimeType];
    const filename = `${milestoneId}-${randomUUID()}${extension}`;
    await writeFile(join(dir, filename), buffer);

    return join(MILESTONES_SUBDIR, filename);
  }

  /**
   * Reads a previously-saved photo. Returns `null` (never throws) if the file
   * is missing on disk — `MilestoneService` treats a stored row with no
   * backing file as an expected-but-logged drift case (404, not 500).
   */
  async read(relativePath: string): Promise<Buffer | null> {
    try {
      return await readFile(join(resolveUploadsDir(), relativePath));
    } catch (error) {
      if (isEnoent(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Best-effort delete of a previously-saved photo. Never throws — by the time
   * this is called the DB row has already moved on (photo row deleted, or the
   * whole milestone gone), so a missing file or a permissions error is logged
   * and swallowed rather than failing the request. That is M-9 in one method:
   * leftover files must not make a delete fail.
   */
  async delete(relativePath: string): Promise<void> {
    try {
      await rm(join(resolveUploadsDir(), relativePath));
    } catch (error) {
      this.logger.warn(`Failed to delete photo file "${relativePath}": ${String(error)}`);
    }
  }
}
