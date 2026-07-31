import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { resolveUploadsDir } from '../config/uploads-dir';
import type { AllowedPhotoMimeType } from './child-photo.constants';
import { PHOTO_MIME_TYPE_TO_EXTENSION } from './child-photo.constants';

const CHILDREN_SUBDIR = 'children';

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

/**
 * Reads/writes child photo files on local disk, under
 * `<resolveUploadsDir()>/children/`. Every write happens under a fresh,
 * unguessable filename — existing files are never overwritten in place —
 * which is what makes the ordered write-then-commit-then-delete-old
 * sequence in `ChildService` safe. See ADR-0003 for the full design.
 */
@Injectable()
export class ChildPhotoStorageService {
  private readonly logger = new Logger(ChildPhotoStorageService.name);

  /**
   * Writes `buffer` to disk and returns the path to store on
   * `Child.photoPath`, relative to `resolveUploadsDir()` (e.g.
   * `children/<childId>-<uuid>.jpg`). The extension is derived solely from
   * the already-validated `mimeType`, never from client input.
   */
  async save(childId: string, mimeType: AllowedPhotoMimeType, buffer: Buffer): Promise<string> {
    const dir = join(resolveUploadsDir(), CHILDREN_SUBDIR);
    await mkdir(dir, { recursive: true });

    const extension = PHOTO_MIME_TYPE_TO_EXTENSION[mimeType];
    const filename = `${childId}-${randomUUID()}${extension}`;
    await writeFile(join(dir, filename), buffer);

    return join(CHILDREN_SUBDIR, filename);
  }

  /**
   * Reads a previously-saved photo. Returns `null` (never throws) if the
   * file is missing on disk — `ChildService` treats a set `photoPath` with
   * no backing file as an expected-but-logged drift case (404, not 500),
   * not a hard failure of this method.
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
   * Best-effort delete of a previously-saved photo. Never throws — by the
   * time this is called the DB row has already moved on (new photo
   * committed, or the child itself deleted), so a missing file or a
   * permissions error is logged and swallowed rather than failing the
   * request. See the ordered cleanup sequences in ADR-0003.
   */
  async delete(relativePath: string): Promise<void> {
    try {
      await rm(join(resolveUploadsDir(), relativePath));
    } catch (error) {
      this.logger.warn(`Failed to delete photo file "${relativePath}": ${String(error)}`);
    }
  }
}
