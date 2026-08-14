import type { EventType, TimelineEventSummary } from '../api/event-api';
import { deletePendingEvent, markPendingEventFailed, putPendingEvent } from './pendingEvents.db';
import { invalidatePendingEventsQuery } from './usePendingLocalEvents';

/** Prefix that flags a client-generated id (see `PendingEventRecord.localId`). */
const LOCAL_EVENT_ID_PREFIX = 'local-';

function generateLocalEventId(): string {
  return `${LOCAL_EVENT_ID_PREFIX}${crypto.randomUUID()}`;
}

export interface CreateEventOptimisticallyParams<T extends TimelineEventSummary> {
  householdId: string;
  childId: string;
  eventType: EventType;
  /** Synthesizes the row shown immediately, shaped like the server response. */
  buildOptimisticSummary: (localId: string) => T;
  /** The real create request whose authoritative row eventually replaces the optimistic one. */
  apiCall: () => Promise<T>;
  /**
   * The exact request body `apiCall` sends (e.g. `CreateFeedingEventInput`).
   * Persisted verbatim on the buffered record so the sync-queue
   * (`syncQueue.ts`) can resend it later without reconstructing a request from
   * the response-shaped `summary`.
   */
  createInput: unknown;
}

/**
 * The one generic "offline write-through" engine shared by all three event
 * domains (Feeding/Sleep/Diaper). It buffers a new event in IndexedDB *before*
 * firing the network request, so the entry survives a failed or never-sent
 * request, and makes it visible immediately by invalidating the IndexedDB-backed
 * query every mounted list/timeline merges in (see `usePendingLocalEvents`).
 *
 * On success the buffered copy is deleted — the caller's existing
 * `invalidateQueries` on the real feeding/sleep/diaper-events key (unchanged)
 * then refetches the authoritative server row.
 *
 * On failure the buffered copy is deliberately NOT rolled back (a deviation from
 * the textbook TanStack Query optimistic-update recipe): the whole point of
 * "lokale Zwischenspeicherung" is that the entry must not vanish from the local
 * UI just because the network request failed. It is flipped to `status: 'failed'`
 * instead and kept — a future sync-queue slice acts on such records. No
 * retry/backoff is scheduled here.
 */
export async function createEventOptimistically<T extends TimelineEventSummary>(
  params: CreateEventOptimisticallyParams<T>,
): Promise<T> {
  const { householdId, childId, eventType, buildOptimisticSummary, apiCall, createInput } = params;
  const localId = generateLocalEventId();
  const summary = buildOptimisticSummary(localId);

  // 1) Durable write-through, BEFORE the network call.
  await putPendingEvent({
    localId,
    householdId,
    childId,
    eventType,
    status: 'pending',
    savedAt: new Date().toISOString(),
    summary,
    createInput,
  });
  // 2) Make it visible immediately.
  await invalidatePendingEventsQuery(householdId, childId);

  try {
    const serverSummary = await apiCall();
    // Success: the buffered copy's job is done.
    await deletePendingEvent(localId);
    await invalidatePendingEventsQuery(householdId, childId);
    return serverSummary;
  } catch (error) {
    // Failure: keep it (marked failed) both in IndexedDB and, via the merge
    // hook, in the UI. Rethrow the unchanged error so existing error-mapping/
    // `ErrorMessage` handling still works.
    await markPendingEventFailed(localId);
    await invalidatePendingEventsQuery(householdId, childId);
    throw error;
  }
}
