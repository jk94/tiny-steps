import { ApiError } from '../api/http-client';

export type HouseholdErrorKey =
  'household.errors.notFound' | 'household.errors.forbidden' | 'household.errors.generic';

/**
 * Maps a caught household-request failure to a translation key — never to
 * raw `error.body` text, since the backend has no locale awareness (mirrors
 * `auth/mapAuthError.ts`). Status-code-driven only.
 */
export function mapHouseholdError(error: unknown): HouseholdErrorKey {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return 'household.errors.notFound';
    }
    if (error.status === 403) {
      return 'household.errors.forbidden';
    }
  }
  return 'household.errors.generic';
}
