import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http-client';
import { mapAuthError } from './mapAuthError';
import i18n from '../i18n';

describe('mapAuthError', () => {
  it('maps a 401 to the invalid-credentials key in login mode', () => {
    expect(mapAuthError(new ApiError(401, {}), 'login')).toBe('auth.errors.invalidCredentials');
  });

  it('maps a 401 to the invalid-credentials key in register mode', () => {
    expect(mapAuthError(new ApiError(401, {}), 'register')).toBe(
      'auth.errors.invalidCredentials',
    );
  });

  it('maps a 409 in register mode to the email-already-registered key', () => {
    expect(mapAuthError(new ApiError(409, {}), 'register')).toBe(
      'auth.errors.emailAlreadyRegistered',
    );
  });

  it('does not misclassify a 409 in login mode — falls back to generic', () => {
    expect(mapAuthError(new ApiError(409, {}), 'login')).toBe('auth.errors.generic');
  });

  it('maps a 400 to the generic key without inspecting error.body', () => {
    expect(
      mapAuthError(new ApiError(400, { statusCode: 400, message: ['email must be an email'] }), 'login'),
    ).toBe('auth.errors.generic');
  });

  it('maps a 404 to the generic key', () => {
    expect(mapAuthError(new ApiError(404, {}), 'login')).toBe('auth.errors.generic');
  });

  it('maps a plain non-ApiError failure (e.g. network error) to the generic key', () => {
    expect(mapAuthError(new Error('Failed to fetch'), 'login')).toBe('auth.errors.generic');
  });

  it('resolves the invalid-credentials key to the correct English copy', () => {
    expect(i18n.t(mapAuthError(new ApiError(401, {}), 'login'))).toBe('Invalid email or password.');
  });

  it('resolves the email-already-registered key to the correct English copy', () => {
    expect(i18n.t(mapAuthError(new ApiError(409, {}), 'register'))).toBe(
      'This email address is already registered.',
    );
  });

  it('resolves the generic key to the correct English copy', () => {
    expect(i18n.t(mapAuthError(new ApiError(400, {}), 'login'))).toBe(
      'Something went wrong. Please try again later.',
    );
  });
});
