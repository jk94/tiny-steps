import { BadRequestException, HttpStatus, ParseFilePipeBuilder } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_BYTES,
  type AllowedPhotoMimeType,
} from './photo.constants';

/**
 * Multipart field name every photo upload in this app uses, so one
 * interceptor configuration serves child profiles and milestones alike.
 */
export const PHOTO_FIELD_NAME = 'photo';

// Mirrors ALLOWED_PHOTO_MIME_TYPES; kept as a literal regex since
// ParseFilePipeBuilder's addFileTypeValidator expects a RegExp/string, not
// an array of exact values.
const PHOTO_MIME_TYPE_PATTERN = /^image\/(jpeg|png|webp)$/;

// Internal-only marker strings threaded through each validator's
// `errorMessage` so photoValidationPipe()'s shared `exceptionFactory` can
// tell which validator failed and attach the right machine-readable `code`
// — matching human-facing message text would be fragile, this isn't.
const PHOTO_TYPE_MISMATCH_MARKER = 'photo-invalid-type';
const PHOTO_TOO_LARGE_MARKER = 'photo-too-large';

/**
 * `photo` arrives as a memory buffer (not written to disk by Multer itself) so
 * the domain service and its photo-storage service fully control where/when/
 * under what name it lands on disk — see ADR-0003. `limits.fileSize` is a hard
 * backstop against buffering an abusive upload into memory;
 * `photoValidationPipe()` below is the actual product-facing 400 for size/type
 * violations.
 */
export function photoFileInterceptor() {
  return FileInterceptor(PHOTO_FIELD_NAME, {
    storage: memoryStorage(),
    limits: { fileSize: MAX_PHOTO_BYTES },
  });
}

/**
 * Validates an uploaded photo's type and size, failing with this app's uniform
 * machine-readable 400 body (`PHOTO_INVALID_TYPE` / `PHOTO_TOO_LARGE`).
 *
 * `isRequired` is the one thing that genuinely differs between consumers: a
 * child photo is an optional part of a larger create/update body, whereas the
 * milestone photo endpoint exists *only* to receive a file.
 *
 * Extracted from `ChildController` in roadmap Phase 7.2, when milestone photos
 * became the second consumer.
 */
export function photoValidationPipe({ isRequired }: { isRequired: boolean }) {
  return new ParseFilePipeBuilder()
    .addFileTypeValidator({
      fileType: PHOTO_MIME_TYPE_PATTERN,
      errorMessage: PHOTO_TYPE_MISMATCH_MARKER,
    })
    .addMaxSizeValidator({ maxSize: MAX_PHOTO_BYTES, errorMessage: PHOTO_TOO_LARGE_MARKER })
    .build({
      fileIsRequired: isRequired,
      errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      exceptionFactory: (marker) => {
        const code =
          marker === PHOTO_TYPE_MISMATCH_MARKER ? 'PHOTO_INVALID_TYPE' : 'PHOTO_TOO_LARGE';
        const message =
          code === 'PHOTO_INVALID_TYPE'
            ? 'Please choose a JPEG, PNG, or WebP image.'
            : 'The photo must be at most 2 MB.';
        return new BadRequestException({ statusCode: 400, code, message });
      },
    });
}

/**
 * Validates+narrows an uploaded file's `mimetype` into `AllowedPhotoMimeType`.
 * Should be unreachable in practice — `photoValidationPipe()` already rejects
 * any other mime type before this is called — but this is the defensive
 * application-layer boundary, mirroring `toHouseholdRole()` in
 * `household-role.enum.ts`.
 */
export function toAllowedPhotoMimeType(mimeType: string): AllowedPhotoMimeType {
  if ((ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return mimeType as AllowedPhotoMimeType;
  }
  throw new Error(`Unexpected photo mime type: ${mimeType}`);
}
