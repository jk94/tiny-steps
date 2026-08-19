import { ApiError } from '../api/http-client';

export type ChildErrorKey =
  | 'child.errors.forbidden'
  | 'child.errors.notFound'
  | 'child.errors.invalidName'
  | 'child.errors.invalidBirthDate'
  | 'child.errors.photoTooLarge'
  | 'child.errors.photoInvalidType'
  | 'child.errors.photoUploadError'
  | 'child.errors.invalidInput'
  | 'child.errors.generic';

interface ChildErrorBody {
  code?: string;
  fields?: Record<string, string[]>;
}

function isChildErrorBody(body: unknown): body is ChildErrorBody {
  return typeof body === 'object' && body !== null;
}

/** Maps a `VALIDATION_ERROR` body's `fields` to a field-specific key, falling back to the generic one when both/neither field is present. */
function mapValidationFields(fields: Record<string, string[]> | undefined): ChildErrorKey {
  const failedFields = Object.keys(fields ?? {});
  if (failedFields.length === 1 && failedFields[0] === 'name') {
    return 'child.errors.invalidName';
  }
  if (failedFields.length === 1 && failedFields[0] === 'birthDate') {
    return 'child.errors.invalidBirthDate';
  }
  return 'child.errors.invalidInput';
}

/**
 * Maps a caught child-request failure to a translation key — never to raw
 * `error.body` text (mirrors `auth/mapAuthError.ts`). Status-code-driven,
 * refined by the backend's machine-readable `code` for 400s (see
 * `ChildController`'s `ChildValidationExceptionFilter`/
 * `photoValidationPipe()`) where available; an unrecognized or missing
 * `code` — e.g. an older backend — falls back to the generic invalid-input
 * key rather than guessing.
 */
export function mapChildError(error: unknown): ChildErrorKey {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return 'child.errors.forbidden';
    }
    if (error.status === 404) {
      return 'child.errors.notFound';
    }
    if (error.status === 400) {
      const body = isChildErrorBody(error.body) ? error.body : undefined;
      switch (body?.code) {
        case 'VALIDATION_ERROR':
          return mapValidationFields(body.fields);
        case 'PHOTO_TOO_LARGE':
          return 'child.errors.photoTooLarge';
        case 'PHOTO_INVALID_TYPE':
          return 'child.errors.photoInvalidType';
        case 'PHOTO_UPLOAD_ERROR':
          return 'child.errors.photoUploadError';
        default:
          return 'child.errors.invalidInput';
      }
    }
  }
  return 'child.errors.generic';
}
