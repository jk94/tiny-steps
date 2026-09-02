import { uploadMilestonePhoto } from '../api/milestone-api';
import { mapMilestoneError } from './mapMilestoneError';

/**
 * Where one queued photo stands.
 *
 * The distinction that matters is **retryable or not**:
 * - `pending` — passed client-side validation and is not on the server yet.
 *   A previous *server* attempt may have failed; the entry then also carries an
 *   `errorKey` for display but stays in this state, because resending the exact
 *   same bytes is a perfectly reasonable thing to do.
 * - `done` — accepted by the server. Never uploaded again.
 * - `error` — rejected by *client-side* validation (wrong type, too large).
 *   Retrying as-is would fail identically, so the user has to remove it or pick
 *   a different file; the form refuses to submit while one is queued.
 *
 * There is deliberately no `uploading` state: uploads run sequentially inside a
 * single awaited call, so no render ever observes one in flight.
 */
export type PhotoUploadStatus = 'pending' | 'done' | 'error';

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
  /** Set for a client-side rejection or a failed server attempt. */
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
 * Uploads every not-yet-stored photo one request at a time and reports the
 * outcome **per file**.
 *
 * Sequential rather than parallel on purpose: the server assigns `sortIndex`
 * as "current maximum + 1" (M-10), so concurrent uploads could interleave and
 * land the photos in an order the user did not pick. A handful of ≤2 MB files
 * is fast enough either way.
 *
 * One failure never discards the others (M-15) — a rejected file keeps its
 * place in the queue and the loop continues. A server-side failure comes back
 * as `pending` **with** an `errorKey`, i.e. visibly failed but still retryable:
 * pressing save again resends exactly those files and nothing else.
 *
 * An entry that is already `done` is skipped, so a retry can never upload the
 * same photo twice.
 */
export async function uploadQueuedPhotos(
  householdId: string,
  childId: string,
  milestoneId: string,
  photos: QueuedPhoto[],
): Promise<QueuedPhoto[]> {
  const results: QueuedPhoto[] = [];

  for (const photo of photos) {
    if (photo.status !== 'pending') {
      // Already on the server, or rejected client-side — either way there is
      // nothing to send.
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
        // Stays `pending`: the bytes are fine, the request was not.
        status: 'pending',
        errorKey: PER_FILE_ERROR_KEYS.has(mapped)
          ? (mapped as QueuedPhotoErrorKey)
          : 'milestone.errors.photoUploadError',
      });
    }
  }

  return results;
}

/**
 * How many photos an upload run left un-stored. Zero means the run fully
 * succeeded and the caller may report success (M-15).
 */
export function countPendingPhotos(photos: QueuedPhoto[]): number {
  return photos.filter((photo) => photo.status === 'pending').length;
}

/**
 * Folds an upload run's outcome back into the form's queue, matching on id.
 *
 * `done` entries drop out: they now belong to the milestone's stored photos and
 * are rendered from the server response instead, so keeping them here would
 * show the same photo twice and let it be counted against the upload limit a
 * second time. What remains is exactly "what still needs attention".
 */
export function mergePhotoResults(current: QueuedPhoto[], results: QueuedPhoto[]): QueuedPhoto[] {
  const byId = new Map(results.map((photo) => [photo.id, photo]));
  const updated = current.map((photo) => byId.get(photo.id) ?? photo);
  const appended = results.filter((photo) => !current.some((entry) => entry.id === photo.id));

  return [...updated, ...appended].filter((photo) => photo.status !== 'done');
}
