import {
  EVENT_TYPE_QUERY_KEY_SEGMENT,
  isEventAlreadyStoppedError,
  isEventConflictError,
  type EventType,
  type TimelineEventSummary,
} from '../api/event-api';
import { queryClient } from '../lib/query-client';
import { clearActiveTimerCache } from './activeTimerCache';
import { recordConflictNotice } from './conflictNotices';
import {
  deletePendingEvent,
  findPendingUpdateForEvent,
  markPendingEventFailed,
  putPendingEvent,
} from './pendingEvents.db';
import { invalidatePendingEventsQuery } from './usePendingLocalEvents';

/** Prefix that flags a client-generated id (see `PendingEventRecord.localId`). */
const LOCAL_EVENT_ID_PREFIX = 'local-';

function generateLocalEventId(): string {
  return `${LOCAL_EVENT_ID_PREFIX}${crypto.randomUUID()}`;
}

/**
 * Invalidates the authoritative per-domain list query, so the confirmed (or, on
 * conflict, the server's winning) row is refetched. Shared shape with the
 * sync-queue's own invalidation.
 */
function invalidateDomainQuery(householdId: string, childId: string, eventType: EventType) {
  const segment = EVENT_TYPE_QUERY_KEY_SEGMENT[eventType];
  return queryClient.invalidateQueries({
    queryKey: ['households', householdId, 'children', childId, segment],
  });
}

export interface UpdateEventOptimisticallyParams<T extends TimelineEventSummary> {
  householdId: string;
  childId: string;
  eventType: EventType;
  /** The server id of the event being edited/stopped. */
  targetEventId: string;
  operation: 'update' | 'stop';
  /** Synthesizes the row shown immediately, shaped like the server response
   * (its `id` stays the server `targetEventId` so it overlays the real row). */
  buildOptimisticSummary: () => T;
  /** The real update/stop request whose authoritative row eventually replaces the overlay. */
  apiCall: () => Promise<T>;
  /** The exact request body `apiCall` sends (incl. `clientTimestamp`), persisted
   * so the sync-queue can resend it verbatim after a reconnect. */
  updateInput: unknown;
}

/**
 * The "offline write-through" engine for edits and timer-stops — the
 * update/stop counterpart of `createEventOptimistically`. It buffers the write
 * in IndexedDB *before* the network call, so the change survives a failed or
 * never-sent request, and shows it immediately (the list/timeline merges the
 * buffered record as an overlay onto the matching server row — see
 * `mergeServerAndPendingEvents`).
 *
 * JC-4: if a pending record already targets the same event, its `localId` is
 * reused so the second edit *replaces* the first in place rather than queuing a
 * duplicate.
 *
 * On success (and on the two "drop it, it's resolved" failure cases below) the
 * buffered copy is deleted and the authoritative per-domain query is
 * invalidated/refetched *before* the pending-overlay query is invalidated —
 * deliberately in that order. Doing it the other way round (as an earlier
 * version of this function did) opens a one-render window where the pending
 * overlay is already gone but the domain query (e.g. a running-timer query)
 * hasn't refetched yet, so a consumer like `FeedingTimer`/`SleepTimer` briefly
 * flips back to "still running" — which unmounts/remounts the timer
 * component, silently resetting its `useMutation`'s `isPending` guard and
 * re-enabling its Stop button. That's what let a single confused extra click
 * fire a *second*, genuinely redundant stop request in the first place (see
 * the `isEventAlreadyStoppedError` case below).
 *
 * On failure there are three cases (see ADR-0011 and its addendum):
 *  - Last-Write-Wins conflict (`isEventConflictError`): the buffered write lost,
 *    so it's deleted (not retryable), a dismissible conflict notice is recorded
 *    (JC-3), and the domain query is invalidated so the server's winning values
 *    are refetched. The original error is rethrown so the caller can tell a
 *    conflict apart from an ordinary failure.
 *  - Redundant timer-stop (`isEventAlreadyStoppedError`, `operation === 'stop'`
 *    only): the timer was already stopped by an earlier attempt (this client's
 *    own resent/duplicate click, or another client). The desired end state
 *    already holds, so — unlike an LWW conflict — no notice is recorded; the
 *    buffered record is simply dropped and the domain query refetched so the
 *    UI reflects the real (already-stopped) event instead of getting stuck
 *    showing a permanent "not saved" ghost row. The error is still rethrown.
 *  - Ordinary failure (network/5xx): the record is flipped to `failed` and kept,
 *    so the user's edited values stay visible with a badge (JC-2) and the
 *    sync-queue retries it later. The error is rethrown unchanged.
 */

/**
 * Shared "this pending write is resolved" cleanup for the success,
 * LWW-conflict, and already-stopped cases: refresh the authoritative domain
 * query first, then drop the buffered overlay — see the ordering rationale
 * above.
 *
 * For `operation === 'stop'`, the active-timer query is *additionally*
 * cleared directly (cancel + `setQueryData(null)`) rather than left to the
 * generic `invalidateDomainQuery` refetch below — see `clearActiveTimerCache`'s
 * doc comment for why a plain invalidate isn't sufficient on its own (it can
 * lose a race against an unrelated, already-in-flight fetch for the same
 * query, e.g. one triggered moments earlier by a WebSocket reconnect).
 */
async function resolvePendingRecord(
  localId: string,
  householdId: string,
  childId: string,
  eventType: EventType,
  operation: 'update' | 'stop',
): Promise<void> {
  if (operation === 'stop') {
    await clearActiveTimerCache(householdId, childId, eventType);
  }
  await invalidateDomainQuery(householdId, childId, eventType);
  await deletePendingEvent(localId);
  await invalidatePendingEventsQuery(householdId, childId);
}
export async function updateEventOptimistically<T extends TimelineEventSummary>(
  params: UpdateEventOptimisticallyParams<T>,
): Promise<T> {
  const {
    householdId,
    childId,
    eventType,
    targetEventId,
    operation,
    buildOptimisticSummary,
    apiCall,
    updateInput,
  } = params;

  // JC-4: replace an existing pending write for the same event in place.
  const existing = await findPendingUpdateForEvent(targetEventId);
  const localId = existing?.localId ?? generateLocalEventId();
  const summary = buildOptimisticSummary();

  // 1) Durable write-through, BEFORE the network call.
  await putPendingEvent({
    localId,
    householdId,
    childId,
    eventType,
    status: 'pending',
    savedAt: new Date().toISOString(),
    summary,
    operation,
    targetEventId,
    updateInput,
  });
  // 2) Make the overlay visible immediately.
  await invalidatePendingEventsQuery(householdId, childId);

  try {
    const serverSummary = await apiCall();
    await resolvePendingRecord(localId, householdId, childId, eventType, operation);
    return serverSummary;
  } catch (error) {
    if (isEventConflictError(error)) {
      // The server had a newer write — LWW says it wins. Drop the buffered copy
      // (no point retrying a losing write) and surface a dismissible notice.
      await resolvePendingRecord(localId, householdId, childId, eventType, operation);
      recordConflictNotice(eventType, targetEventId);
      throw error;
    }
    if (operation === 'stop' && isEventAlreadyStoppedError(error)) {
      // Redundant stop — the timer was already stopped by an earlier attempt.
      // Same cleanup as a conflict, but no notice: nothing was actually lost.
      await resolvePendingRecord(localId, householdId, childId, eventType, operation);
      throw error;
    }
    // Ordinary failure: keep the edited values visible (JC-2), let the
    // sync-queue retry.
    await markPendingEventFailed(localId);
    await invalidatePendingEventsQuery(householdId, childId);
    throw error;
  }
}
