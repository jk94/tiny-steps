import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http-client';
import { mapInviteError } from './mapInviteError';
import i18n from '../i18n';

describe('mapInviteError', () => {
  it('maps a 404 to the accept-failed key', () => {
    expect(mapInviteError(new ApiError(404, {}))).toBe('invite.errors.acceptFailed');
  });

  it('maps a 401 to the generic key', () => {
    expect(mapInviteError(new ApiError(401, {}))).toBe('invite.errors.generic');
  });

  it('maps a plain non-ApiError failure (e.g. network error) to the generic key', () => {
    expect(mapInviteError(new Error('Failed to fetch'))).toBe('invite.errors.generic');
  });

  it('resolves the accept-failed key to the correct English copy', () => {
    expect(i18n.t(mapInviteError(new ApiError(404, {})))).toBe(
      "This invitation couldn't be accepted. It may be invalid or expired.",
    );
  });

  it('resolves the generic key to the correct English copy', () => {
    expect(i18n.t(mapInviteError(new ApiError(500, {})))).toBe(
      'Something went wrong. Please try again later.',
    );
  });
});
