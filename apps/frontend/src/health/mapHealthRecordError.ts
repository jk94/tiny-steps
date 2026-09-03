import { ApiError } from '../api/http-client';

export type HealthRecordErrorKey =
  | 'health.errors.forbidden'
  | 'health.errors.notFound'
  | 'health.errors.invalidName'
  | 'health.errors.invalidInput'
  | 'health.validation.missingDate'
  | 'health.validation.doseUnitRequired'
  | 'health.validation.fieldNotAllowedForKind'
  | 'health.validation.administeredAtBeforeBirth'
  | 'health.errors.generic';

interface HealthRecordErrorBody {
  code?: string;
  fields?: Record<string, string[]>;
}

function isHealthRecordErrorBody(body: unknown): body is HealthRecordErrorBody {
  return typeof body === 'object' && body !== null;
}

/**
 * Maps a `VALIDATION_ERROR` body's `fields` to a field-specific key, falling
 * back to the generic one when several (or no) fields failed — naming one of
 * three failing fields would be misleading.
 */
function mapValidationFields(fields: Record<string, string[]> | undefined): HealthRecordErrorKey {
  const failedFields = Object.keys(fields ?? {});
  if (failedFields.length === 1 && failedFields[0] === 'name') {
    return 'health.errors.invalidName';
  }
  return 'health.errors.invalidInput';
}

/**
 * Maps a caught health-record request failure to a translation key — never to
 * raw `error.body` text (mirrors `milestone/mapMilestoneError.ts`).
 * Status-code-driven, refined by the backend's machine-readable `code` where
 * available; an unrecognized or missing `code` falls back to a generic key
 * rather than guessing.
 *
 * The four cross-column codes are the interesting ones: each names a concrete
 * thing the user can fix in the form (add a date, add a unit, drop a field that
 * belongs to the other kind, correct the timestamp), so none of them may
 * disappear into a generic "something went wrong". They are reachable even
 * though the form pre-checks all four — a stale cached birth date or a second
 * device editing the same record can still trip them.
 */
export function mapHealthRecordError(error: unknown): HealthRecordErrorKey {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return 'health.errors.forbidden';
    }
    if (error.status === 404) {
      return 'health.errors.notFound';
    }

    const body = isHealthRecordErrorBody(error.body) ? error.body : undefined;

    if (error.status === 400) {
      switch (body?.code) {
        case 'VALIDATION_ERROR':
          return mapValidationFields(body.fields);
        case 'HEALTH_RECORD_MISSING_DATE':
          return 'health.validation.missingDate';
        case 'HEALTH_RECORD_DOSE_UNIT_REQUIRED':
          return 'health.validation.doseUnitRequired';
        case 'HEALTH_RECORD_FIELD_NOT_ALLOWED_FOR_KIND':
          return 'health.validation.fieldNotAllowedForKind';
        case 'HEALTH_RECORD_ADMINISTERED_AT_BEFORE_BIRTH':
          return 'health.validation.administeredAtBeforeBirth';
        default:
          return 'health.errors.invalidInput';
      }
    }
  }
  return 'health.errors.generic';
}
