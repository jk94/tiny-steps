import { ConflictException } from '@nestjs/common';
import type { DiaperEventSummary } from '../diaper/diaper.service';
import type { FeedingEventSummary } from '../feeding/feeding.service';
import type { SleepEventSummary } from '../sleep/sleep.service';

/** Discriminator on the response body, letting the frontend tell a
 * Last-Write-Wins conflict apart from the controllers' other plain-string
 * `ConflictException`s (timer-already-running / already-stopped). */
export const EVENT_CONFLICT_CODE = 'EVENT_CONFLICT';

/** Discriminator for `EventAlreadyStoppedException` — see its doc comment. */
export const EVENT_ALREADY_STOPPED_CODE = 'EVENT_ALREADY_STOPPED';

type EventSummary = FeedingEventSummary | SleepEventSummary | DiaperEventSummary;

/**
 * Thrown when an offline-buffered edit/timer-stop is applied but the server-side
 * record was modified more recently (its `updatedAt` is newer than the buffered
 * write's `clientTimestamp`). Last-Write-Wins: the newer server write wins and
 * the buffered one is rejected, carrying the current winning summary back to the
 * client so it can reconcile without a second round-trip — see ADR-0011.
 *
 * Deliberately a 409 like the existing timer conflicts, but distinguishable via
 * the `code: EVENT_CONFLICT` field on the response body (the others send a plain
 * string message).
 */
export class EventConflictException extends ConflictException {
  constructor(currentEvent: EventSummary) {
    super({ code: EVENT_CONFLICT_CODE, currentEvent });
  }
}

/**
 * Thrown by `stop()` when the timer has already been stopped (`endedAt` is
 * already set on the row). Reachable via a duplicate stop request — a UI
 * race that resends the same click, a resent offline-buffered stop, or a
 * second device stopping the same timer first. Unlike `EventConflictException`,
 * this isn't a case of two different writes competing: the desired end state
 * (the timer being stopped) already holds, so it's a redundant request rather
 * than a genuine conflict. Deliberately a 409 like the others here, but
 * distinguishable via `code: EVENT_ALREADY_STOPPED` so the frontend can treat
 * it as an idempotent no-op — see `isEventAlreadyStoppedError` and
 * `updateEventOptimistically` (ADR-0011 addendum).
 */
export class EventAlreadyStoppedException extends ConflictException {
  constructor(currentEvent: EventSummary) {
    super({ code: EVENT_ALREADY_STOPPED_CODE, currentEvent });
  }
}

/**
 * Last-Write-Wins gate shared by all three services' `update()`/`stop()`. When
 * a buffered write carries a `clientTimestamp`, it only applies if that instant
 * is at least as recent as the server row's `updatedAt`; a strictly-newer server
 * write means someone else wrote later, so this throws `EventConflictException`
 * (with the current winning summary) and the caller skips its DB write. A
 * missing `clientTimestamp` (a normal online request) is a no-op, preserving the
 * pre-ADR-0011 unconditional-apply behavior. See ADR-0011 (JC-1).
 */
export function assertNoLaterServerWrite(
  serverUpdatedAt: Date,
  clientTimestamp: string | undefined,
  buildCurrentSummary: () => EventSummary,
): void {
  if (clientTimestamp === undefined) {
    return;
  }
  if (serverUpdatedAt.getTime() > new Date(clientTimestamp).getTime()) {
    throw new EventConflictException(buildCurrentSummary());
  }
}
