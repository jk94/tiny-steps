/**
 * Product-facing photo upload limits, shared by every domain that stores
 * photos on local disk (child profiles since ADR-0003, milestones since
 * roadmap Phase 7.2 / M-7).
 *
 * Extracted here rather than copied per domain: the limits are one product
 * decision, and a second copy would drift the moment one of them is relaxed.
 * Enforced by `ParseFilePipeBuilder` on the uploading controllers (see
 * `MulterExceptionFilter` for the lower-level Multer backstop).
 */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

/**
 * Maps a *validated* MIME type to the file extension used when persisting a
 * photo to disk. Never derive the stored extension from the client-supplied
 * original filename — see `ChildPhotoStorageService.save()` /
 * `MilestonePhotoStorageService.save()`.
 */
export const PHOTO_MIME_TYPE_TO_EXTENSION: Record<AllowedPhotoMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * How many photos one milestone may carry (M-7).
 *
 * A per-record cap rather than a per-household quota: photos are the first
 * place in this app where user data grows without bound, and the roadmap
 * deliberately limits that through these ceilings instead of introducing
 * storage accounting. Ten × 2 MB is generous for one memory while keeping the
 * worst case a self-hoster has to size for predictable.
 */
export const MAX_PHOTOS_PER_MILESTONE = 10;
