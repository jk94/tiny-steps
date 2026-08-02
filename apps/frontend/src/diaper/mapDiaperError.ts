import { ApiError } from '../api/http-client';

export type DiaperErrorKey =
  'diaper.errors.notFound' | 'diaper.errors.invalidInput' | 'diaper.errors.generic';

export type DiaperErrorContext = 'create' | 'update' | 'delete';

/**
 * Maps a caught diaper-request failure to a translation key — never to raw
 * `error.body` text (mirrors `feeding/mapFeedingError.ts`/
 * `sleep/mapSleepError.ts`). No 409/`timerConflict` branch at all — no
 * such case exists in `DiaperController` (Diaper is never timer-based).
 * `context` is currently unused in the function body but kept for
 * call-site parity with `mapFeedingError`/`mapSleepError`, in case a
 * future status-code disambiguation need arises here too.
 */
export function mapDiaperError(error: unknown, context: DiaperErrorContext): DiaperErrorKey {
  // Referenced only to keep the parameter part of the function's public
  // signature (see doc comment above) without tripping no-unused-vars.
  void context;
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return 'diaper.errors.notFound';
    }
    if (error.status === 400) {
      return 'diaper.errors.invalidInput';
    }
  }
  return 'diaper.errors.generic';
}
