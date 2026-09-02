/**
 * Child-photo upload limits.
 *
 * The values themselves moved to `common/photo/photo.constants.ts` when
 * milestone photos became a second consumer (roadmap Phase 7.2 / M-7) — the
 * limits are one product decision, not a per-domain one. This module stays as
 * the child domain's import surface so existing call sites keep reading
 * naturally; there is deliberately no second copy of the values.
 */
export {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_BYTES,
  PHOTO_MIME_TYPE_TO_EXTENSION,
  type AllowedPhotoMimeType,
} from '../common/photo/photo.constants';
