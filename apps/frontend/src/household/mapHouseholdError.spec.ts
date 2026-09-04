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

  it('maps a 403 with CANNOT_CHANGE_OWN_ROLE to its own key', () => {
    expect(mapHouseholdError(new ApiError(403, { code: 'CANNOT_CHANGE_OWN_ROLE' }))).toBe(
      'household.errors.cannotChangeOwnRole',
    );
  });

  it('maps a 403 with CANNOT_REMOVE_SELF to its own key', () => {
    expect(mapHouseholdError(new ApiError(403, { code: 'CANNOT_REMOVE_SELF' }))).toBe(
      'household.errors.cannotRemoveSelf',
    );
  });

  it('maps a 403 with an unknown code to the generic forbidden key', () => {
    expect(mapHouseholdError(new ApiError(403, { code: 'SOMETHING_NEW' }))).toBe(
      'household.errors.forbidden',
    );
  });

  it('maps a 409 with LAST_OWNER_CANNOT_BE_DEMOTED to its own key', () => {
    expect(mapHouseholdError(new ApiError(409, { code: 'LAST_OWNER_CANNOT_BE_DEMOTED' }))).toBe(
      'household.errors.lastOwnerCannotBeDemoted',
    );
  });

  it('maps a 409 with LAST_OWNER_CANNOT_BE_REMOVED to its own key', () => {
    expect(mapHouseholdError(new ApiError(409, { code: 'LAST_OWNER_CANNOT_BE_REMOVED' }))).toBe(
      'household.errors.lastOwnerCannotBeRemoved',
    );
  });

  it('maps a 409 without a recognizable code to the generic key', () => {
    expect(mapHouseholdError(new ApiError(409, {}))).toBe('household.errors.generic');
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

  it('resolves the last-owner key to actionable English copy', () => {
    expect(
      i18n.t(mapHouseholdError(new ApiError(409, { code: 'LAST_OWNER_CANNOT_BE_DEMOTED' }))),
    ).toBe("This is the household's last owner. Make someone else an owner first.");
  });

  it('resolves the generic key to the correct English copy', () => {
    expect(i18n.t(mapHouseholdError(new ApiError(500, {})))).toBe(
      'Something went wrong. Please try again later.',
    );
  });
});
