import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http-client';
import { mapChildError } from './mapChildError';
import i18n from '../i18n';

describe('mapChildError', () => {
  it('maps a 403 to the forbidden key', () => {
    expect(mapChildError(new ApiError(403, {}))).toBe('child.errors.forbidden');
  });

  it('maps a 404 to the not-found key', () => {
    expect(mapChildError(new ApiError(404, {}))).toBe('child.errors.notFound');
  });

  it('maps a 400 with no recognized code to the generic invalid-input key', () => {
    expect(
      mapChildError(new ApiError(400, { message: ['birthDate must not be in the future'] })),
    ).toBe('child.errors.invalidInput');
  });

  it('maps a VALIDATION_ERROR naming only "name" to the invalid-name key', () => {
    expect(
      mapChildError(
        new ApiError(400, {
          code: 'VALIDATION_ERROR',
          fields: { name: ['name should not be empty'] },
        }),
      ),
    ).toBe('child.errors.invalidName');
  });

  it('maps a VALIDATION_ERROR naming only "birthDate" to the invalid-birth-date key', () => {
    expect(
      mapChildError(
        new ApiError(400, {
          code: 'VALIDATION_ERROR',
          fields: { birthDate: ['birthDate must not be in the future'] },
        }),
      ),
    ).toBe('child.errors.invalidBirthDate');
  });

  it('maps a VALIDATION_ERROR naming both fields to the generic invalid-input key', () => {
    expect(
      mapChildError(
        new ApiError(400, {
          code: 'VALIDATION_ERROR',
          fields: {
            name: ['name should not be empty'],
            birthDate: ['birthDate must not be in the future'],
          },
        }),
      ),
    ).toBe('child.errors.invalidInput');
  });

  it('maps a PHOTO_TOO_LARGE code to the photo-too-large key', () => {
    expect(mapChildError(new ApiError(400, { code: 'PHOTO_TOO_LARGE' }))).toBe(
      'child.errors.photoTooLarge',
    );
  });

  it('maps a PHOTO_INVALID_TYPE code to the photo-invalid-type key', () => {
    expect(mapChildError(new ApiError(400, { code: 'PHOTO_INVALID_TYPE' }))).toBe(
      'child.errors.photoInvalidType',
    );
  });

  it('maps a PHOTO_UPLOAD_ERROR code to the photo-upload-error key', () => {
    expect(mapChildError(new ApiError(400, { code: 'PHOTO_UPLOAD_ERROR' }))).toBe(
      'child.errors.photoUploadError',
    );
  });

  it('maps a plain non-ApiError failure (e.g. network error) to the generic key', () => {
    expect(mapChildError(new Error('Failed to fetch'))).toBe('child.errors.generic');
  });

  it('resolves the forbidden key to the correct English copy', () => {
    expect(i18n.t(mapChildError(new ApiError(403, {})))).toBe(
      'Only the household owner can perform this action.',
    );
  });

  it('resolves the not-found key to the correct English copy', () => {
    expect(i18n.t(mapChildError(new ApiError(404, {})))).toBe("This child profile wasn't found.");
  });

  it('resolves the invalid-input key to the correct English copy', () => {
    expect(i18n.t(mapChildError(new ApiError(400, {})))).toBe(
      "Couldn't save your changes. Please check the name, birth date, and photo.",
    );
  });

  it('resolves the generic key to the correct English copy', () => {
    expect(i18n.t(mapChildError(new ApiError(500, {})))).toBe(
      'Something went wrong. Please try again later.',
    );
  });
});
