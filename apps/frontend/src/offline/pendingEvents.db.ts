import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { EventType, TimelineEventSummary } from '../api/event-api';

/**
 * A locally-buffered event is either still awaiting its server round-trip
 * (`pending`) or has had that round-trip fail (`failed`). A future sync-queue
 * slice acts on `failed` records; this slice only ever creates `pending` ones
 * and flips them to `failed` on error (it never retries).
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
  /** ISO — informational only; no retry/backoff scheduling reads this in this slice. */
  savedAt: string;
  /**
   * Shaped exactly like the eventual server response (`id` = `localId` for
   * now), so it can be rendered by the same list-row code with zero
   * transformation.
   */
  summary: TimelineEventSummary;
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
 * Lists locally-buffered events for a household+child, newest first, optionally
 * narrowed to a single `eventType` (per-type Home pages pass one; the daily
 * timeline passes none).
 */
export async function listPendingEvents(
  householdId: string,
  childId: string,
  eventType?: EventType,
): Promise<PendingEventRecord[]> {
  const db = await getDb();
  const records = await db.getAllFromIndex(STORE_NAME, BY_CHILD_INDEX, [householdId, childId]);
  const filtered =
    eventType === undefined ? records : records.filter((record) => record.eventType === eventType);
  return filtered.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
