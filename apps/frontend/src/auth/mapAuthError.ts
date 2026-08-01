import { ApiError } from '../api/http-client';

export type AuthErrorKey =
  | 'auth.errors.invalidCredentials'
  | 'auth.errors.emailAlreadyRegistered'
  | 'auth.errors.generic';

/**
 * Maps a caught login/register failure to a translation key — never to raw
 * `error.body` text, since the backend has no locale awareness (ADR-0005)
 * and always responds in English regardless of the active UI language.
 * Status-code-driven only.
 */
export function mapAuthError(error: unknown, mode: 'login' | 'register'): AuthErrorKey {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'auth.errors.invalidCredentials';
    }
    if (mode === 'register' && error.status === 409) {
      return 'auth.errors.emailAlreadyRegistered';
    }
  }
  return 'auth.errors.generic';
}
