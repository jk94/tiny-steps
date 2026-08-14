import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { EventType, TimelineEventSummary } from '../api/event-api';

/**
 * A locally-buffered event is either still awaiting its server round-trip
 * (`pending`) or has had that round-trip fail (`failed`). The sync-queue
 * (`syncQueue.ts`) resends both on the next reconnect/online trigger; the
 * optimistic write-through (`createEventOptimistically`) only ever creates
 * `pending` ones and flips them to `failed` on error.
 */
export type LocalEventStatus = 'pending' | 'failed';

export interface PendingEventRecord {
  /**
   * Primary key. Client-generated, e.g. `local-${crypto.randomUUID()}` —
   * always prefixed so it can never collide with (or be confused for) a
   * server-assigned cuid; matters once a future sync-queue slice needs to tell
   * "still local" ids apart from confirmed ones.
   */
  localId: string;
  householdId: string;
  childId: string;
  eventType: EventType;
  status: LocalEventStatus;
  /** ISO — informational; the sync-queue also orders its drain by this. */
  savedAt: string;
  /**
   * Shaped exactly like the eventual server response (`id` = `localId` for
   * now), so it can be rendered by the same list-row code with zero
   * transformation.
   */
  summary: TimelineEventSummary;
  /**
   * The exact request body passed to the domain's plain create function
   * (e.g. `CreateFeedingEventInput`). Persisted so the sync-queue can resend
   * this exact record without reconstructing a request from `summary` (which
   * is response-shaped, not request-shaped). Absent on records written by a
   * pre-sync-queue build still sitting in a client's IndexedDB after an app
   * update — the drain skips those permanently.
   */
  createInput?: unknown;
  /**
   * What kind of write this buffered record represents. `undefined` (the
   * default for both legacy records and every `create*EventOptimistic` call
   * site) means a create; `'update'` an edit (PATCH); `'stop'` a timer-stop.
   * Additive, so no `idb` version bump is needed — see ADR-0011.
   */
  operation?: 'update' | 'stop';
  /**
   * The server id of the event an `'update'`/`'stop'` record targets. Always
   * set whenever `operation` is set. Used both to resend the write and to
   * overlay the matching server row at render time (see
   * `mergeServerAndPendingEvents`). Undefined for create records (their target
   * doesn't exist server-side yet).
   */
  targetEventId?: string;
  /**
   * The exact request body for an `'update'`/`'stop'` resend (parallel to
   * `createInput`), including the `clientTimestamp` that drives Last-Write-Wins.
   * The sync-queue replays this verbatim. Undefined for create records.
   */
  updateInput?: unknown;
  /** Resend attempts made by the sync-queue so far. Undefined == 0. */
  retryCount?: number;
  /** ISO timestamp before which the queue won't retry this record. Undefined == eligible now. */
  nextRetryAt?: string;
}

const DB_NAME = 'baby-tracker-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pendingEvents';
const BY_CHILD_INDEX = 'byChild';

interface PendingEventsDb extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: PendingEventRecord;
    indexes: { [BY_CHILD_INDEX]: [string, string] };
  };
}

let dbPromise: Promise<IDBPDatabase<PendingEventsDb>> | null = null;

/**
 * Lazily opens (and memoizes) the single offline database. Kept behind a
 * module-level promise so every caller shares one connection instead of
 * reopening it per operation.
 */
function getDb(): Promise<IDBPDatabase<PendingEventsDb>> {
  if (dbPromise === null) {
    dbPromise = openDB<PendingEventsDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
        // Compound index so pending events can be scoped to a single
        // household+child in one indexed read (see `listPendingEvents`).
        store.createIndex(BY_CHILD_INDEX, ['householdId', 'childId']);
      },
    });
  }
  return dbPromise;
}

export async function putPendingEvent(record: PendingEventRecord): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, record);
}

export async function deletePendingEvent(localId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, localId);
}

/**
 * Marks a still-buffered event as `failed` in place — a no-op if it's already
 * been deleted (e.g. a late success/failure race), keeping the caller's
 * error-handling path idempotent.
 */
export async function markPendingEventFailed(localId: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get(STORE_NAME, localId);
  if (!existing) {
    return;
  }
  await db.put(STORE_NAME, { ...existing, status: 'failed' });
}

/**
 * Lists locally-buffered events for a household+child, optionally narrowed to a
 * single `eventType` (per-type Home pages pass one; the daily timeline passes
 * none). Returns records in the underlying index order — ordering the rendered
 * list is `mergeServerAndPendingEvents`'s job (it re-sorts by `occurredAt`), so
 * this read deliberately doesn't sort.
 */
export async function listPendingEvents(
  householdId: string,
  childId: string,
  eventType?: EventType,
): Promise<PendingEventRecord[]> {
  const db = await getDb();
  const records = await db.getAllFromIndex(STORE_NAME, BY_CHILD_INDEX, [householdId, childId]);
  return eventType === undefined
    ? records
    : records.filter((record) => record.eventType === eventType);
}

/**
 * Household/child-agnostic full-store scan for the sync-queue's drain
 * (`syncQueue.ts`) — deliberately the whole store, not the `byChild` index,
 * since the store stays small (a family's offline buffer, not thousands of
 * rows) and the drain needs every buffered record regardless of which
 * household/child page is currently mounted.
 */
export async function listAllPendingEvents(): Promise<PendingEventRecord[]> {
  const db = await getDb();
  return db.getAll(STORE_NAME);
}

/**
 * Finds an existing buffered `'update'`/`'stop'` record targeting a given server
 * event, if any. A full-store scan (like `listAllPendingEvents`) since the store
 * is small and there's no index on `targetEventId`. Supports JC-4: a second
 * offline edit/stop of the same event replaces the pending record in place
 * (reusing its `localId`) instead of queuing a duplicate — see
 * `updateEventOptimistically` and ADR-0011.
 */
export async function findPendingUpdateForEvent(
  targetEventId: string,
): Promise<PendingEventRecord | undefined> {
  const db = await getDb();
  const all = await db.getAll(STORE_NAME);
  return all.find(
    (record) => record.operation !== undefined && record.targetEventId === targetEventId,
  );
}

/**
 * Records the outcome of a sync-queue resend attempt in place: bumps
 * `retryCount` and (optionally) sets the earliest instant the next attempt may
 * run at. Keeps `status: 'failed'` so the record stays visible in the UI. A
 * no-op if the record was already deleted (e.g. a concurrent success),
 * mirroring `markPendingEventFailed`.
 */
export async function markPendingEventRetryScheduled(
  localId: string,
  retryCount: number,
  nextRetryAt?: string,
): Promise<void> {
  const db = await getDb();
  const existing = await db.get(STORE_NAME, localId);
  if (!existing) {
    return;
  }
  await db.put(STORE_NAME, { ...existing, status: 'failed', retryCount, nextRetryAt });
}
