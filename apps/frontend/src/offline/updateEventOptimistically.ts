import {
  EVENT_TYPE_QUERY_KEY_SEGMENT,
  isEventConflictError,
  type EventType,
  type TimelineEventSummary,
} from '../api/event-api';
import { queryClient } from '../lib/query-client';
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
 * On success the buffered copy is deleted and both the pending and the
 * authoritative per-domain queries are invalidated (the confirmed server row
 * then replaces the overlay).
 *
 * On failure there are two cases (see ADR-0011):
 *  - Last-Write-Wins conflict (`isEventConflictError`): the buffered write lost,
 *    so it's deleted (not retryable), a dismissible conflict notice is recorded
 *    (JC-3), and the domain query is invalidated so the server's winning values
 *    are refetched. The original error is rethrown so the caller can tell a
 *    conflict apart from an ordinary failure.
 *  - Ordinary failure (network/5xx): the record is flipped to `failed` and kept,
 *    so the user's edited values stay visible with a badge (JC-2) and the
 *    sync-queue retries it later. The error is rethrown unchanged.
 */
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
    await deletePendingEvent(localId);
    await invalidatePendingEventsQuery(householdId, childId);
    await invalidateDomainQuery(householdId, childId, eventType);
    return serverSummary;
  } catch (error) {
    if (isEventConflictError(error)) {
      // The server had a newer write — LWW says it wins. Drop the buffered copy
      // (no point retrying a losing write) and surface a dismissible notice.
      await deletePendingEvent(localId);
      await invalidatePendingEventsQuery(householdId, childId);
      await invalidateDomainQuery(householdId, childId, eventType);
      recordConflictNotice(eventType, targetEventId);
      throw error;
    }
    // Ordinary failure: keep the edited values visible (JC-2), let the
    // sync-queue retry.
    await markPendingEventFailed(localId);
    await invalidatePendingEventsQuery(householdId, childId);
    throw error;
  }
}
