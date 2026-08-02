import { ApiError } from '../api/http-client';

export type SleepErrorKey =
  | 'sleep.errors.notFound'
  | 'sleep.errors.invalidInput'
  | 'sleep.errors.timerConflict'
  | 'sleep.errors.timerAlreadyStopped'
  | 'sleep.errors.generic';

export type SleepErrorContext = 'create' | 'stop' | 'update' | 'delete';

/**
 * Maps a caught sleep-request failure to a translation key — never to raw
 * `error.body` text (mirrors `feeding/mapFeedingError.ts`). Status-code-
 * driven, but a 409 means two different things depending on which request
 * caused it, so `context` disambiguates between them:
 *  - on `create`, 409 means "a sleep timer is already running for this
 *    child" (`SleepService.create`'s active-timer conflict check).
 *  - on `stop`, 409 means "this timer was already stopped"
 *    (`SleepService.stop`).
 * `update`/`delete` never produce a 409 server-side, but are listed
 * explicitly so a future 409 case there fails loudly (falls through to the
 * generic key) instead of silently reusing the wrong message.
 */
export function mapSleepError(error: unknown, context: SleepErrorContext): SleepErrorKey {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return 'sleep.errors.notFound';
    }
    if (error.status === 400) {
      return 'sleep.errors.invalidInput';
    }
    if (error.status === 409) {
      if (context === 'create') {
        return 'sleep.errors.timerConflict';
      }
      if (context === 'stop') {
        return 'sleep.errors.timerAlreadyStopped';
      }
    }
  }
  return 'sleep.errors.generic';
}
