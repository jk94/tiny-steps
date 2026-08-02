import { ApiError } from '../api/http-client';

export type FeedingErrorKey =
  | 'feeding.errors.notFound'
  | 'feeding.errors.invalidInput'
  | 'feeding.errors.timerConflict'
  | 'feeding.errors.timerAlreadyStopped'
  | 'feeding.errors.generic';

export type FeedingErrorContext = 'create' | 'stop' | 'update' | 'delete';

/**
 * Maps a caught feeding-request failure to a translation key — never to raw
 * `error.body` text (mirrors `child/mapChildError.ts`). Status-code-driven,
 * but a 409 means two different things depending on which request caused
 * it, so `context` disambiguates between them:
 *  - on `create`, 409 means "a breastfeeding timer is already running for
 *    this child" (`FeedingService.create`'s active-timer conflict check).
 *  - on `stop`, 409 means "this timer was already stopped" (or the event
 *    isn't a BREAST feed) (`FeedingService.stop`).
 * `update`/`delete` never produce a 409 server-side, but are listed
 * explicitly so a future 409 case there fails loudly (falls through to the
 * generic key) instead of silently reusing the wrong message.
 */
export function mapFeedingError(error: unknown, context: FeedingErrorContext): FeedingErrorKey {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return 'feeding.errors.notFound';
    }
    if (error.status === 400) {
      return 'feeding.errors.invalidInput';
    }
    if (error.status === 409) {
      if (context === 'create') {
        return 'feeding.errors.timerConflict';
      }
      if (context === 'stop') {
        return 'feeding.errors.timerAlreadyStopped';
      }
    }
  }
  return 'feeding.errors.generic';
}
