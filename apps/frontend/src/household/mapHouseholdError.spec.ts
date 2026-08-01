import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http-client';
import { mapHouseholdError } from './mapHouseholdError';
import i18n from '../i18n';

describe('mapHouseholdError', () => {
  it('maps a 404 to the not-found key', () => {
    expect(mapHouseholdError(new ApiError(404, {}))).toBe('household.errors.notFound');
  });

  it('maps a 403 to the forbidden key', () => {
    expect(mapHouseholdError(new ApiError(403, {}))).toBe('household.errors.forbidden');
  });

  it('maps a 400 to the generic key', () => {
    expect(mapHouseholdError(new ApiError(400, {}))).toBe('household.errors.generic');
  });

  it('maps a plain non-ApiError failure (e.g. network error) to the generic key', () => {
    expect(mapHouseholdError(new Error('Failed to fetch'))).toBe('household.errors.generic');
  });

  it('resolves the not-found key to the correct English copy', () => {
    expect(i18n.t(mapHouseholdError(new ApiError(404, {})))).toBe(
      "This household wasn't found, or you aren't a member.",
    );
  });

  it('resolves the forbidden key to the correct English copy', () => {
    expect(i18n.t(mapHouseholdError(new ApiError(403, {})))).toBe(
      'Only the household owner can perform this action.',
    );
  });

  it('resolves the generic key to the correct English copy', () => {
    expect(i18n.t(mapHouseholdError(new ApiError(500, {})))).toBe(
      'Something went wrong. Please try again later.',
    );
  });
});
