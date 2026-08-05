import { createDiaperEvent, type CreateDiaperEventInput } from '../api/diaper-api';
import {
  EVENT_TYPE_QUERY_KEY_SEGMENT,
  type EventType,
  type TimelineEventSummary,
} from '../api/event-api';
import { createFeedingEvent, type CreateFeedingEventInput } from '../api/feeding-api';
import { ApiError } from '../api/http-client';
import { createSleepEvent, type CreateSleepEventInput } from '../api/sleep-api';
import { queryClient } from '../lib/query-client';
import {
  deletePendingEvent,
  listAllPendingEvents,
  markPendingEventRetryScheduled,
  type PendingEventRecord,
} from './pendingEvents.db';
import { invalidatePendingEventsQuery } from './usePendingLocalEvents';

/**
 * Offline sync-queue: resends locally-buffered (`pending`/`failed`) event
 * creations to the server once connectivity returns. Triggered by
 * `SyncQueueProvider` on `navigator.onLine`'s `online` event and on the
 * Socket.IO connection coming up; a lone unresolved failure also reschedules
 * itself via a timer (see `runDrain`), so it eventually retries even without a
 * further external trigger.
 *
 * Delivery guarantee: at-least-once, deliberately. There are two ways a resend
 * can duplicate a server-side event:
 *   1. Response-lost: the original POST from `createEventOptimistically`
 *      actually succeeded server-side, but its response never reached the
 *      client (so the buffered record was never deleted) and a later drain
 *      resends it.
 *   2. In-flight overlap (the broader, more likely window): a record can still
 *      be `status: 'pending'` with its *original* `apiCall()` from
 *      `createEventOptimistically` still in flight — neither succeeded nor
 *      failed yet — when a connectivity-change trigger (the `online` event or a
 *      Socket.IO reconnect) fires a drain. The drain's eligibility filter only
 *      checks `retryCount < MAX_RETRY_ATTEMPTS` and whether `nextRetryAt` is
 *      due; it cannot tell "still in flight" from "genuinely failed / never
 *      sent", so it may resend the record concurrently with its own original
 *      request and double-post the same logical event even when the network
 *      never actually dropped.
 * This is an accepted trade-off for this slice — de-duplicating would require
 * either a backend idempotency-key column (out of scope: no schema changes
 * here) or content-based dedup, which is effectively part of the deferred
 * Last-Write-Wins conflict-resolution work. It is documented rather than
 * silently omitted.
 */

/** Total resend attempts per record before it's abandoned as permanently failed. */
const MAX_RETRY_ATTEMPTS = 6;
/** Base of the exponential backoff — first retry waits this long. */
const BASE_RETRY_DELAY_MS = 2_000;
/** Upper bound on any single backoff wait, so late retries don't stall for hours. */
const MAX_RETRY_DELAY_MS = 5 * 60_000;

/**
 * Maps an event type to its plain (non-optimistic) create function. Each entry
 * casts the persisted `createInput` to the matching request type — the single,
 * deliberately-loosely-typed seam in this module. It is safe because
 * `eventType` and `createInput` are always written together by the matching
 * domain's `create*EventOptimistic`, so the cast can never mismatch.
 */
const CREATE_FN_BY_EVENT_TYPE: Record<
  EventType,
  (householdId: string, childId: string, input: unknown) => Promise<TimelineEventSummary>
> = {
  FEEDING: (householdId, childId, input) =>
    createFeedingEvent(householdId, childId, input as CreateFeedingEventInput),
  SLEEP: (householdId, childId, input) =>
    createSleepEvent(householdId, childId, input as CreateSleepEventInput),
  DIAPER: (householdId, childId, input) =>
    createDiaperEvent(householdId, childId, input as CreateDiaperEventInput),
};

/**
 * Whether a failed resend is worth retrying. A 4xx means the request itself is
 * malformed/unauthorized — retrying the identical payload can't help, so it's
 * abandoned. A 5xx or a raw network failure (fetch throwing a `TypeError` with
 * no `status`, e.g. still offline) is treated as transient and retried.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500;
  }
  return true;
}

/** Exponential backoff (`BASE * 2^retryCount`), capped at `MAX_RETRY_DELAY_MS`. */
function computeNextRetryDelay(retryCount: number): number {
  const delay = BASE_RETRY_DELAY_MS * 2 ** retryCount;
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

/**
 * Invalidates the authoritative per-domain query for this record's type, so the
 * confirmed server row is refetched. Done explicitly rather than relying on the
 * client currently being joined to the household's Socket.IO room (which drives
 * the realtime `event:changed` invalidation) — the drain can run on any route.
 */
function invalidateDomainQuery(record: PendingEventRecord): Promise<void> {
  const segment = EVENT_TYPE_QUERY_KEY_SEGMENT[record.eventType];
  return queryClient.invalidateQueries({
    queryKey: ['households', record.householdId, 'children', record.childId, segment],
  });
}

/**
 * Records a resend failure in place and returns the ISO instant of the next
 * scheduled attempt, or `undefined` if the record is being abandoned (a 4xx, or
 * the retry cap reached). Abandoning fast-forwards `retryCount` to the cap so
 * the same eligibility check that stops "ran out of retries" also stops "never
 * retry this 4xx" — no separate flag needed.
 */
async function recordResendFailure(
  record: PendingEventRecord,
  error: unknown,
): Promise<string | undefined> {
  const attempts = record.retryCount ?? 0;
  const canRetry = isRetryableError(error) && attempts < MAX_RETRY_ATTEMPTS - 1;
  if (!canRetry) {
    await markPendingEventRetryScheduled(record.localId, MAX_RETRY_ATTEMPTS);
    return undefined;
  }
  const nextRetryAt = new Date(Date.now() + computeNextRetryDelay(attempts)).toISOString();
  await markPendingEventRetryScheduled(record.localId, attempts + 1, nextRetryAt);
  return nextRetryAt;
}

/**
 * Resends a single buffered record. Returns the ISO instant of a scheduled
 * future retry (so the caller can plan the next autonomous drain), or
 * `undefined` when nothing further is pending for this record (success, a
 * permanently-skipped legacy record, or an abandoned one).
 */
async function resendPendingEvent(record: PendingEventRecord): Promise<string | undefined> {
  if (record.createInput === undefined) {
    // Legacy record from a pre-sync-queue build: no request body was persisted,
    // so it can't be resent. Leave it failed forever rather than guessing one.
    return undefined;
  }

  const createEvent = CREATE_FN_BY_EVENT_TYPE[record.eventType];
  try {
    await createEvent(record.householdId, record.childId, record.createInput);
  } catch (error) {
    return recordResendFailure(record, error);
  }

  // Confirmed: drop the buffered copy and refresh both the pending-events query
  // (removes the now-gone ghost row) and the authoritative per-domain query.
  await deletePendingEvent(record.localId);
  await invalidatePendingEventsQuery(record.householdId, record.childId);
  await invalidateDomainQuery(record);
  return undefined;
}

let scheduledRetryTimeout: ReturnType<typeof setTimeout> | null = null;

/** Schedules the next autonomous drain for the soonest still-pending retry. */
function scheduleNextDrain(futureRetryTimes: string[]): void {
  const soonest = futureRetryTimes.reduce((earliest, time) => (time < earliest ? time : earliest));
  const delay = Math.max(0, Date.parse(soonest) - Date.now());
  scheduledRetryTimeout = setTimeout(() => {
    scheduledRetryTimeout = null;
    void drainPendingEventQueue();
  }, delay);
}

async function runDrain(): Promise<void> {
  // Replace any previously-scheduled autonomous retry — this run re-derives
  // what still needs scheduling, so old timers must not pile up.
  if (scheduledRetryTimeout !== null) {
    clearTimeout(scheduledRetryTimeout);
    scheduledRetryTimeout = null;
  }

  // Snapshotted once per run: a record written mid-drain is picked up by the
  // next trigger, not this pass (no data loss, just deferred).
  const records = await listAllPendingEvents();
  const nowIso = new Date().toISOString();

  const isRetryable = (record: PendingEventRecord): boolean =>
    (record.retryCount ?? 0) < MAX_RETRY_ATTEMPTS;
  const isDue = (record: PendingEventRecord): boolean =>
    record.nextRetryAt === undefined || record.nextRetryAt <= nowIso;

  // Records still in backoff feed the reschedule calculation but aren't resent
  // now. (`nextRetryAt` is an ISO-8601 UTC instant, so string comparison is
  // chronological.)
  const futureRetryTimes = records
    .filter((record) => isRetryable(record) && !isDue(record))
    .map((record) => record.nextRetryAt as string);

  // Process sequentially, oldest first — avoids bursting many POSTs after a long
  // offline period and keeps server-side ordering deterministic.
  const due = records
    .filter((record) => isRetryable(record) && isDue(record))
    .sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  for (const record of due) {
    try {
      const rescheduledAt = await resendPendingEvent(record);
      if (rescheduledAt !== undefined) {
        futureRetryTimes.push(rescheduledAt);
      }
    } catch (error) {
      // A step other than the (already-caught) `createEvent` call threw — e.g.
      // an IndexedDB delete/update or a query invalidation. Surface it but keep
      // draining: one record's failure must not abort the rest of this pass.
      // The record stays buffered and is reconsidered on the next trigger.
      console.error('Failed to process a buffered event during sync-queue drain', error);
    }
  }

  if (futureRetryTimes.length > 0) {
    scheduleNextDrain(futureRetryTimes);
  }
}

// Single-flight guard, same precedent as `http-client.ts`'s `refreshPromise`:
// a call arriving while a drain is in-flight joins that run instead of starting
// a second overlapping pass.
let drainPromise: Promise<void> | null = null;

/**
 * Resends every eligible buffered event once. Concurrent callers share the same
 * in-flight run. Exported (rather than kept private to the provider) so a future
 * manual "Retry now" affordance can reuse it.
 */
export function drainPendingEventQueue(): Promise<void> {
  if (drainPromise === null) {
    drainPromise = runDrain()
      // Catch here (at the source) rather than at every `void`-invoked call
      // site, so a residual top-level failure — e.g. `listAllPendingEvents()`
      // itself throwing — can never surface as an unhandled rejection. The
      // returned promise always resolves; `.finally` still clears the
      // single-flight guard so a future drain isn't permanently blocked.
      .catch((error) => {
        console.error('Offline sync-queue drain failed', error);
      })
      .finally(() => {
        drainPromise = null;
      });
  }
  return drainPromise;
}
