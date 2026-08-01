import { ApiError } from '../api/http-client';

export type ChildErrorKey =
  | 'child.errors.forbidden'
  | 'child.errors.notFound'
  | 'child.errors.invalidInput'
  | 'child.errors.generic';

/**
 * Maps a caught child-request failure to a translation key — never to raw
 * `error.body` text (mirrors `auth/mapAuthError.ts`). Status-code-driven
 * only.
 */
export function mapChildError(error: unknown): ChildErrorKey {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return 'child.errors.forbidden';
    }
    if (error.status === 404) {
      return 'child.errors.notFound';
    }
    if (error.status === 400) {
      // TODO: once the backend exposes structured error codes for child
      // validation, split this into birthDate/photo-specific keys instead
      // of one generic message.
      return 'child.errors.invalidInput';
    }
  }
  return 'child.errors.generic';
}
