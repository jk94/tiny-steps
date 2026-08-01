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

  it('maps a 400 to the generic invalid-input key', () => {
    expect(
      mapChildError(new ApiError(400, { message: ['birthDate must not be in the future'] })),
    ).toBe('child.errors.invalidInput');
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
