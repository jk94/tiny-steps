import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { FeedingEventSummary } from '../api/feeding-api';

// Only the network seam is mocked; the IndexedDB layer runs for real (against a
// fresh fake-indexeddb per test) so this proves the whole ghost-duplicate
// lifecycle end to end — exactly one buffered record exists throughout.
vi.mock('../api/feeding-api');

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

const serverSummary: FeedingEventSummary = {
  id: 'server-id',
  childId: CHILD_ID,
  userId: 'u1',
  type: 'FEEDING',
  feedingType: 'SOLID',
  occurredAt: '2026-01-01T10:00:00.000Z',
  startedAt: null,
  endedAt: null,
  durationSeconds: null,
  side: null,
  amountMl: null,
  note: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

// The db module memoizes its open-connection promise, so a fresh IDBFactory
// alone wouldn't isolate tests. Reset the module registry too and re-import db,
// syncQueue and the (mocked) feeding-api together, so syncQueue binds to the
// same fresh db instance the test writes through.
let db: typeof import('./pendingEvents.db');
let syncQueue: typeof import('./syncQueue');
let feedingApi: typeof import('../api/feeding-api');

beforeEach(async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.resetModules();
  db = await import('./pendingEvents.db');
  syncQueue = await import('./syncQueue');
  feedingApi = await import('../api/feeding-api');
});

describe('drainPendingEventQueue (integration)', () => {
  it('resends a single failed record and removes it once the server confirms', async () => {
    vi.mocked(feedingApi.createFeedingEvent).mockResolvedValue(serverSummary);
    await db.putPendingEvent({
      localId: 'local-ghost',
      householdId: HOUSEHOLD_ID,
      childId: CHILD_ID,
      eventType: 'FEEDING',
      status: 'failed',
      savedAt: '2026-01-01T10:00:00.000Z',
      summary: { ...serverSummary, id: 'local-ghost' },
      createInput: { feedingType: 'SOLID' },
    });

    await syncQueue.drainPendingEventQueue();

    // Resent exactly once, and the single buffered record is gone — no second
    // local record was ever created, so nothing lingers as a ghost.
    expect(feedingApi.createFeedingEvent).toHaveBeenCalledTimes(1);
    expect(await db.listPendingEvents(HOUSEHOLD_ID, CHILD_ID)).toHaveLength(0);
  });
});
