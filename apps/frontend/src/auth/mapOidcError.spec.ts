import { describe, expect, it } from 'vitest';
import { mapOidcError } from './mapOidcError';
import i18n from '../i18n';

describe('mapOidcError', () => {
  it('maps invalid_state to the invalid-state key', () => {
    expect(mapOidcError('invalid_state')).toBe('auth.oidc.errors.invalidState');
  });

  it('maps idp_error to the idp-error key', () => {
    expect(mapOidcError('idp_error')).toBe('auth.oidc.errors.idpError');
  });

  it('maps auth_failed to the auth-failed key', () => {
    expect(mapOidcError('auth_failed')).toBe('auth.oidc.errors.authFailed');
  });

  it('maps email_required to the email-required key', () => {
    expect(mapOidcError('email_required')).toBe('auth.oidc.errors.emailRequired');
  });

  it('maps email_in_use to the email-in-use key', () => {
    expect(mapOidcError('email_in_use')).toBe('auth.oidc.errors.emailInUse');
  });

  it('falls back to the generic key for an unrecognized code', () => {
    expect(mapOidcError('some_unknown_code')).toBe('auth.oidc.errors.generic');
  });

  it('returns null for a null code', () => {
    expect(mapOidcError(null)).toBeNull();
  });

  it('resolves the invalid-state key to the correct English copy', () => {
    expect(i18n.t(mapOidcError('invalid_state')!)).toBe(
      'Your sign-in session expired or was invalid. Please try again.',
    );
  });

  it('resolves the generic key to the correct English copy', () => {
    expect(i18n.t(mapOidcError('unknown')!)).toBe(
      'Something went wrong signing you in. Please try again later.',
    );
  });
});
