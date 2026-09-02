/**
 * Client-side photo upload constraints for fast feedback before hitting the
 * server. Intentionally mirrors the backend's
 * `apps/backend/src/common/photo/photo.constants.ts` — duplicated by value,
 * not imported, since the frontend and backend are separate packages with
 * no shared-code boundary today. The server remains the authority; these
 * are purely a UX shortcut (see `child/mapChildError.ts` /
 * `milestone/mapMilestoneError.ts` for the server-error fallback).
 *
 * Lives under `lib/` rather than `child/` since roadmap Phase 7.2: milestone
 * photos share the exact same limits, so scoping them to the child domain
 * would have invited a second copy.
 */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

/** How many photos one milestone may carry (M-7). */
export const MAX_PHOTOS_PER_MILESTONE = 10;
