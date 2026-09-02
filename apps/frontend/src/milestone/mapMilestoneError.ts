import { ApiError } from '../api/http-client';

export type MilestoneErrorKey =
  | 'milestone.errors.forbidden'
  | 'milestone.errors.notFound'
  | 'milestone.errors.templateAlreadyRecorded'
  | 'milestone.errors.photoLimitReached'
  | 'milestone.errors.photoTooLarge'
  | 'milestone.errors.photoInvalidType'
  | 'milestone.errors.photoUploadError'
  | 'milestone.errors.templateFieldNotEditable'
  | 'milestone.errors.invalidTitle'
  | 'milestone.errors.invalidAchievedAt'
  | 'milestone.errors.invalidInput'
  | 'milestone.errors.generic';

interface MilestoneErrorBody {
  code?: string;
  fields?: Record<string, string[]>;
}

function isMilestoneErrorBody(body: unknown): body is MilestoneErrorBody {
  return typeof body === 'object' && body !== null;
}

/**
 * Maps a `VALIDATION_ERROR` body's `fields` to a field-specific key, falling
 * back to the generic one when several (or no) fields failed — naming one of
 * three failing fields would be misleading.
 */
function mapValidationFields(fields: Record<string, string[]> | undefined): MilestoneErrorKey {
  const failedFields = Object.keys(fields ?? {});
  if (failedFields.length === 1 && failedFields[0] === 'title') {
    return 'milestone.errors.invalidTitle';
  }
  if (failedFields.length === 1 && failedFields[0] === 'achievedAt') {
    return 'milestone.errors.invalidAchievedAt';
  }
  return 'milestone.errors.invalidInput';
}

/**
 * Maps a caught milestone-request failure to a translation key — never to raw
 * `error.body` text (mirrors `child/mapChildError.ts`). Status-code-driven,
 * refined by the backend's machine-readable `code` where available; an
 * unrecognized or missing `code` falls back to a generic key rather than
 * guessing.
 *
 * The 409 cases are the interesting ones: both are states the user can act on
 * (open the existing entry, delete a photo first), so they must not disappear
 * into a generic "something went wrong".
 */
export function mapMilestoneError(error: unknown): MilestoneErrorKey {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return 'milestone.errors.forbidden';
    }
    if (error.status === 404) {
      return 'milestone.errors.notFound';
    }

    const body = isMilestoneErrorBody(error.body) ? error.body : undefined;

    if (error.status === 409) {
      switch (body?.code) {
        case 'MILESTONE_TEMPLATE_ALREADY_RECORDED':
          return 'milestone.errors.templateAlreadyRecorded';
        case 'MILESTONE_PHOTO_LIMIT_REACHED':
          return 'milestone.errors.photoLimitReached';
        default:
          return 'milestone.errors.generic';
      }
    }

    if (error.status === 400) {
      switch (body?.code) {
        case 'VALIDATION_ERROR':
          return mapValidationFields(body.fields);
        case 'MILESTONE_TEMPLATE_FIELD_NOT_EDITABLE':
          return 'milestone.errors.templateFieldNotEditable';
        case 'PHOTO_TOO_LARGE':
          return 'milestone.errors.photoTooLarge';
        case 'PHOTO_INVALID_TYPE':
          return 'milestone.errors.photoInvalidType';
        case 'PHOTO_UPLOAD_ERROR':
          return 'milestone.errors.photoUploadError';
        default:
          return 'milestone.errors.invalidInput';
      }
    }
  }
  return 'milestone.errors.generic';
}
