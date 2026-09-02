import { uploadMilestonePhoto } from '../api/milestone-api';
import { mapMilestoneError } from './mapMilestoneError';

/** How far one queued photo has got. Reported per file, never aggregated. */
export type PhotoUploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export type QueuedPhotoErrorKey =
  | 'milestone.validation.photoInvalidType'
  | 'milestone.validation.photoTooLarge'
  | 'milestone.errors.photoUploadError'
  | 'milestone.errors.photoLimitReached'
  | 'milestone.errors.photoTooLarge'
  | 'milestone.errors.photoInvalidType';

export interface QueuedPhoto {
  /** Stable within one form session; used as the React key and result id. */
  id: string;
  file: File;
  status: PhotoUploadStatus;
  /** Set for a client-side rejection or a failed upload. */
  errorKey?: QueuedPhotoErrorKey;
}

/**
 * Keys `mapMilestoneError` can return that are meaningful *per file*. Anything
 * else (a 404 on the milestone, a network failure) is reported as the generic
 * upload error, since it says nothing about this particular photo.
 */
const PER_FILE_ERROR_KEYS = new Set<string>([
  'milestone.errors.photoLimitReached',
  'milestone.errors.photoTooLarge',
  'milestone.errors.photoInvalidType',
]);

/**
 * Uploads every queued photo one request at a time and reports the outcome
 * **per file**.
 *
 * Sequential rather than parallel on purpose: the server assigns `sortIndex`
 * as "current maximum + 1" (M-10), so concurrent uploads could interleave and
 * land the photos in an order the user did not pick. A handful of ≤2 MB files
 * is fast enough either way.
 *
 * One failure never discards the others (M-15) — a rejected file is marked
 * `error` and the loop continues, which is exactly what lets the caller keep a
 * partially-uploaded milestone visible instead of pretending it all worked.
 */
export async function uploadQueuedPhotos(
  householdId: string,
  childId: string,
  milestoneId: string,
  photos: QueuedPhoto[],
): Promise<QueuedPhoto[]> {
  const results: QueuedPhoto[] = [];

  for (const photo of photos) {
    if (photo.status === 'error') {
      // Rejected client-side before we got here; nothing to retry.
      results.push(photo);
      continue;
    }
    try {
      await uploadMilestonePhoto(householdId, childId, milestoneId, photo.file);
      results.push({ ...photo, status: 'done', errorKey: undefined });
    } catch (error) {
      const mapped = mapMilestoneError(error);
      results.push({
        ...photo,
        status: 'error',
        errorKey: PER_FILE_ERROR_KEYS.has(mapped)
          ? (mapped as QueuedPhotoErrorKey)
          : 'milestone.errors.photoUploadError',
      });
    }
  }

  return results;
}

/** How many of an upload run's files failed — 0 means "fully successful". */
export function countFailedPhotos(photos: QueuedPhoto[]): number {
  return photos.filter((photo) => photo.status === 'error').length;
}
