/**
 * Product-facing photo upload limits, enforced by `ParseFilePipeBuilder` on
 * `ChildController`'s create/update routes (see `MulterExceptionFilter` for
 * the lower-level Multer backstop). See ADR-0003 for the full rationale.
 */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

/**
 * Maps a *validated* MIME type to the file extension used when persisting a
 * photo to disk. Never derive the stored extension from the client-supplied
 * original filename — see `ChildPhotoStorageService.save()`.
 */
export const PHOTO_MIME_TYPE_TO_EXTENSION: Record<AllowedPhotoMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
