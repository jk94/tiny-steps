import {
  createDiaperEvent,
  updateDiaperEvent,
  type CreateDiaperEventInput,
  type UpdateDiaperEventInput,
} from '../api/diaper-api';
import {
  EVENT_TYPE_QUERY_KEY_SEGMENT,
  isEventAlreadyStoppedError,
  isEventConflictError,
  type EventType,
  type TimelineEventSummary,
} from '../api/event-api';
import {
  createFeedingEvent,
  stopFeedingTimer,
  updateFeedingEvent,
  type CreateFeedingEventInput,
  type UpdateFeedingEventInput,
} from '../api/feeding-api';
import { ApiError } from '../api/http-client';
import {
  createSleepEvent,
  stopSleepTimer,
  updateSleepEvent,
  type CreateSleepEventInput,
  type UpdateSleepEventInput,
} from '../api/sleep-api';
import { queryClient } from '../lib/query-client';
import { clearActiveTimerCache } from './activeTimerCache';
import { recordConflictNotice } from './conflictNotices';
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
 * Maps an event type to its plain (non-optimistic) update function — the
 * `'update'`-operation counterpart of `CREATE_FN_BY_EVENT_TYPE`. Same
 * loosely-typed seam: `eventType` and `updateInput` are always written together
 * by the matching `update*EventOptimistic`, so the cast can't mismatch.
 */
const UPDATE_FN_BY_EVENT_TYPE: Record<
  EventType,
  (
    householdId: string,
    childId: string,
    eventId: string,
    input: unknown,
  ) => Promise<TimelineEventSummary>
> = {
  FEEDING: (householdId, childId, eventId, input) =>
    updateFeedingEvent(householdId, childId, eventId, input as UpdateFeedingEventInput),
  SLEEP: (householdId, childId, eventId, input) =>
    updateSleepEvent(householdId, childId, eventId, input as UpdateSleepEventInput),
  DIAPER: (householdId, childId, eventId, input) =>
    updateDiaperEvent(householdId, childId, eventId, input as UpdateDiaperEventInput),
};

/**
 * Maps an event type to its timer-stop function. Only FEEDING/SLEEP are
 * timer-based — a `'stop'` record for DIAPER is unreachable-by-construction and
 * handled defensively at the call site.
 */
const STOP_FN_BY_EVENT_TYPE: Partial<
  Record<
    EventType,
    (
      householdId: string,
      childId: string,
      eventId: string,
      clientTimestamp?: string,
    ) => Promise<TimelineEventSummary>
  >
> = {
  FEEDING: stopFeedingTimer,
  SLEEP: stopSleepTimer,
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
 * Confirmed resend: refresh the authoritative per-domain query, then drop the
 * buffered copy and refresh the pending-events query. Shared by the
 * create/update/stop success paths.
 *
 * Order matters, same rationale as `updateEventOptimistically`'s
 * `resolvePendingRecord`: the domain query (e.g. a running-timer query) is
 * refetched *before* the pending overlay is removed, so there is never a
 * render where the overlay is gone but the domain query still reports stale
 * (e.g. "still running") data. This drain can run concurrently with the
 * pending record's own original request (see the "in-flight overlap" note in
 * this module's doc comment, and — critically — it can also fire from a
 * completely incidental WebSocket reconnect that has nothing to do with the
 * record being processed), so getting this order wrong here reintroduces the
 * timer-flicker/stuck-timer bug even when the record's own
 * `updateEventOptimistically` call already got the ordering right.
 *
 * For a `'stop'` record, the active-timer query is *additionally* cleared
 * directly (cancel + `setQueryData(null)`) rather than left to the generic
 * `invalidateDomainQuery` refetch above — a plain invalidate can still lose a
 * race against an unrelated, already-in-flight fetch for that exact query
 * (e.g. one kicked off moments earlier by `RealtimeProvider`'s broad
 * `['households']` invalidation on the very same reconnect that triggered this
 * drain). See `clearActiveTimerCache`'s doc comment for the full rationale.
 */
async function confirmResend(record: PendingEventRecord): Promise<void> {
  if (record.operation === 'stop') {
    await clearActiveTimerCache(record.householdId, record.childId, record.eventType);
  }
  await invalidateDomainQuery(record);
  await deletePendingEvent(record.localId);
  await invalidatePendingEventsQuery(record.householdId, record.childId);
}

/**
 * Resolves a Last-Write-Wins conflict hit while resending a buffered edit/stop:
 * the server had a newer write, so the buffered one is dropped (never retried),
 * a dismissible notice is recorded (JC-3), and both queries are refreshed so the
 * server's winning values are shown. Returns `undefined` (no retry scheduled).
 * Same domain-query-before-pending-delete ordering as `confirmResend` — see its
 * doc comment, including the active-timer handling for `'stop'` records.
 */
async function resolveResendConflict(record: PendingEventRecord): Promise<undefined> {
  if (record.operation === 'stop') {
    await clearActiveTimerCache(record.householdId, record.childId, record.eventType);
  }
  await invalidateDomainQuery(record);
  await deletePendingEvent(record.localId);
  if (record.targetEventId !== undefined) {
    recordConflictNotice(record.eventType, record.targetEventId);
  }
  await invalidatePendingEventsQuery(record.householdId, record.childId);
  return undefined;
}

/** Resends a buffered create (the original ADR-0010 path). */
async function resendCreate(record: PendingEventRecord): Promise<string | undefined> {
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
  await confirmResend(record);
  return undefined;
}

/** Resends a buffered edit (PATCH). LWW conflicts resolve without a retry. */
async function resendUpdate(record: PendingEventRecord): Promise<string | undefined> {
  if (record.updateInput === undefined || record.targetEventId === undefined) {
    return undefined; // malformed/legacy — nothing to resend
  }
  const updateEvent = UPDATE_FN_BY_EVENT_TYPE[record.eventType];
  try {
    await updateEvent(record.householdId, record.childId, record.targetEventId, record.updateInput);
  } catch (error) {
    if (isEventConflictError(error)) {
      return resolveResendConflict(record);
    }
    return recordResendFailure(record, error);
  }
  await confirmResend(record);
  return undefined;
}

/** Resends a buffered timer-stop. LWW conflicts resolve without a retry. */
async function resendStop(record: PendingEventRecord): Promise<string | undefined> {
  if (record.targetEventId === undefined) {
    return undefined;
  }
  const stopTimer = STOP_FN_BY_EVENT_TYPE[record.eventType];
  if (stopTimer === undefined) {
    // A 'stop' record for a non-timer type (DIAPER) is unreachable by
    // construction — no stop*Optimistic wrapper produces one. Log and leave it
    // failed rather than crash the drain.
    console.error(`Unexpected 'stop' record for event type ${record.eventType}; leaving it failed`);
    return undefined;
  }
  const clientTimestamp = (record.updateInput as { clientTimestamp?: string } | undefined)
    ?.clientTimestamp;
  try {
    await stopTimer(record.householdId, record.childId, record.targetEventId, clientTimestamp);
  } catch (error) {
    if (isEventConflictError(error)) {
      return resolveResendConflict(record);
    }
    if (isEventAlreadyStoppedError(error)) {
      // Redundant resend: this drain caught up with a stop that already
      // reached the server (via this client's own earlier attempt, or another
      // client winning first) — see the `updateEventOptimistically` addendum.
      // Drop it like a confirmed success instead of leaving it permanently
      // `failed` (a 409 is non-retryable, so without this it would otherwise
      // never be cleaned up — the permanent "not saved" ghost row this fixes).
      await confirmResend(record);
      return undefined;
    }
    return recordResendFailure(record, error);
  }
  await confirmResend(record);
  return undefined;
}

/**
 * Resends a single buffered record, dispatching on its `operation`. Returns the
 * ISO instant of a scheduled future retry (so the caller can plan the next
 * autonomous drain), or `undefined` when nothing further is pending for this
 * record (success, a resolved conflict, a permanently-skipped legacy record, or
 * an abandoned one).
 */
function resendPendingEvent(record: PendingEventRecord): Promise<string | undefined> {
  switch (record.operation) {
    case 'update':
      return resendUpdate(record);
    case 'stop':
      return resendStop(record);
    default:
      return resendCreate(record);
  }
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
