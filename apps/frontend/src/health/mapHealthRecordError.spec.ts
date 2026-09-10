import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http-client';
import { mapHealthRecordError } from './mapHealthRecordError';

function apiError(status: number, body?: unknown): ApiError {
  return new ApiError(status, body);
}

describe('mapHealthRecordError', () => {
  it.each([
    [403, 'health.errors.forbidden'],
    [404, 'health.errors.notFound'],
  ] as const)('maps status %i by itself', (status, key) => {
    expect(mapHealthRecordError(apiError(status))).toBe(key);
  });

  // Each of these names a concrete thing the user can fix, so none may
  // disappear into a generic "something went wrong".
  it.each([
    ['HEALTH_RECORD_MISSING_DATE', 'health.validation.missingDate'],
    ['HEALTH_RECORD_DOSE_UNIT_REQUIRED', 'health.validation.doseUnitRequired'],
    ['HEALTH_RECORD_FIELD_NOT_ALLOWED_FOR_KIND', 'health.validation.fieldNotAllowedForKind'],
    ['HEALTH_RECORD_ADMINISTERED_AT_BEFORE_BIRTH', 'health.validation.administeredAtBeforeBirth'],
  ] as const)('maps the cross-column code %s', (code, key) => {
    expect(mapHealthRecordError(apiError(400, { code }))).toBe(key);
  });

  it('names the field when exactly one failed validation', () => {
    expect(
      mapHealthRecordError(
        apiError(400, { code: 'VALIDATION_ERROR', fields: { name: ['name is too long'] } }),
      ),
    ).toBe('health.errors.invalidName');
  });

  it('stays generic when several fields failed — naming one would mislead', () => {
    expect(
      mapHealthRecordError(
        apiError(400, {
          code: 'VALIDATION_ERROR',
          fields: { name: ['too long'], dueAt: ['not a date'] },
        }),
      ),
    ).toBe('health.errors.invalidInput');
  });

  it('falls back rather than guessing for an unknown or missing code', () => {
    expect(mapHealthRecordError(apiError(400, { code: 'SOMETHING_NEW' }))).toBe(
      'health.errors.invalidInput',
    );
    expect(mapHealthRecordError(apiError(400))).toBe('health.errors.invalidInput');
    expect(mapHealthRecordError(apiError(500))).toBe('health.errors.generic');
  });

  it('maps a non-ApiError (e.g. an offline fetch rejection) to the generic key', () => {
    // MED-15: offline saving fails visibly, and this is the message it fails
    // with — never a faked success.
    expect(mapHealthRecordError(new TypeError('Failed to fetch'))).toBe('health.errors.generic');
  });
});
