import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { FeedingEventSummary } from '../api/feeding-api';
import type { SleepEventSummary } from '../api/sleep-api';
import type { PendingEventRecord } from './pendingEvents.db';

// Only the network seam (`apiFetch`) is mocked; the IndexedDB layer and the
// optimistic write-through engines all run for real (against a fresh
// fake-indexeddb per test). This proves the "input works while offline, no data
// is lost" requirement (roadmap Phase 4) directly against IndexedDB — genuinely
// across all three domains (Feeding-create, Diaper-create, Sleep-create) and all
// operation types (create/update/stop, via a Feeding-update and Feeding-stop) —
// rather than against transient React state.
vi.mock('../api/http-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/http-client')>();
  return { ...actual, apiFetch: vi.fn() };
});

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const USER_ID = 'u1';

// A known, already-server-persisted feeding the offline edit targets.
const existingBottleFeeding: FeedingEventSummary = {
  id: 'server-feed-1',
  childId: CHILD_ID,
  userId: USER_ID,
  type: 'FEEDING',
  feedingType: 'BOTTLE',
  occurredAt: '2026-01-01T10:00:00.000Z',
  startedAt: null,
  endedAt: null,
  durationSeconds: null,
  side: null,
  amountMl: 90,
  note: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

// A known, already-server-persisted *active* BREAST timer the offline stop
// targets (has a `startedAt`, no `endedAt` yet).
const activeBreastFeeding: FeedingEventSummary = {
  id: 'server-feed-2',
  childId: CHILD_ID,
  userId: USER_ID,
  type: 'FEEDING',
  feedingType: 'BREAST',
  occurredAt: '2026-01-01T11:00:00.000Z',
  startedAt: '2026-01-01T11:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  side: 'LEFT',
  amountMl: null,
  note: null,
  createdAt: '2026-01-01T11:00:00.000Z',
  updatedAt: '2026-01-01T11:00:00.000Z',
};

const STOP_TIMESTAMP = '2026-01-01T11:30:00.000Z';
const EXPECTED_STOP_DURATION_SECONDS = 30 * 60;

// The start instant entered for the offline Sleep-create.
const SLEEP_STARTED_AT = '2026-01-01T09:00:00.000Z';

// The db module memoizes its open-connection promise, so a fresh IDBFactory
// alone wouldn't isolate tests. Reset the module registry too and re-import db
// and the domain APIs together, so they bind to the same fresh db instance the
// test reads back through.
let db: typeof import('./pendingEvents.db');
let httpClient: typeof import('../api/http-client');
let feedingApi: typeof import('../api/feeding-api');
let diaperApi: typeof import('../api/diaper-api');
let sleepApi: typeof import('../api/sleep-api');

beforeEach(async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.resetModules();
  db = await import('./pendingEvents.db');
  httpClient = await import('../api/http-client');
  feedingApi = await import('../api/feeding-api');
  diaperApi = await import('../api/diaper-api');
  sleepApi = await import('../api/sleep-api');
  // "Offline": every network call rejects, mirroring the existing offline
  // convention (see `updateOptimistic.integration.spec.ts`).
  vi.mocked(httpClient.apiFetch).mockRejectedValue(new TypeError('offline'));
});

/** Locates the single buffered record matching a predicate, failing loudly otherwise. */
function findRecord(
  records: PendingEventRecord[],
  predicate: (record: PendingEventRecord) => boolean,
): PendingEventRecord {
  const matches = records.filter(predicate);
  expect(matches).toHaveLength(1);
  return matches[0];
}

/** Asserts the five buffered records carry exactly the offline-entered values. */
function assertAllFiveRecords(records: PendingEventRecord[]): void {
  expect(records).toHaveLength(5);
  expect(records.every((record) => record.status === 'failed')).toBe(true);

  const feedingCreate = findRecord(
    records,
    (record) => record.eventType === 'FEEDING' && record.operation === undefined,
  );
  expect(feedingCreate.targetEventId).toBeUndefined();
  expect(feedingCreate.createInput).toEqual({ feedingType: 'BOTTLE', amountMl: 90 });
  expect((feedingCreate.summary as FeedingEventSummary).amountMl).toBe(90);

  const diaperCreate = findRecord(
    records,
    (record) => record.eventType === 'DIAPER' && record.operation === undefined,
  );
  expect(diaperCreate.targetEventId).toBeUndefined();
  expect(diaperCreate.createInput).toEqual({ diaperType: 'STOOL' });
  expect((diaperCreate.summary as { diaperType: string }).diaperType).toBe('STOOL');

  const sleepCreate = findRecord(
    records,
    (record) => record.eventType === 'SLEEP' && record.operation === undefined,
  );
  expect(sleepCreate.targetEventId).toBeUndefined();
  expect(sleepCreate.createInput).toEqual({ startedAt: SLEEP_STARTED_AT });
  expect((sleepCreate.summary as SleepEventSummary).startedAt).toBe(SLEEP_STARTED_AT);

  const feedingUpdate = findRecord(records, (record) => record.operation === 'update');
  expect(feedingUpdate.eventType).toBe('FEEDING');
  expect(feedingUpdate.targetEventId).toBe('server-feed-1');
  expect(feedingUpdate.updateInput).toEqual({
    amountMl: 150,
    clientTimestamp: '2026-01-01T10:15:00.000Z',
  });
  expect((feedingUpdate.summary as FeedingEventSummary).amountMl).toBe(150);

  const feedingStop = findRecord(records, (record) => record.operation === 'stop');
  expect(feedingStop.eventType).toBe('FEEDING');
  expect(feedingStop.targetEventId).toBe('server-feed-2');
  expect((feedingStop.updateInput as { clientTimestamp: string }).clientTimestamp).toBe(
    STOP_TIMESTAMP,
  );
  const stopSummary = feedingStop.summary as FeedingEventSummary;
  expect(stopSummary.endedAt).toBe(STOP_TIMESTAMP);
  expect(stopSummary.durationSeconds).toBe(EXPECTED_STOP_DURATION_SECONDS);
}

describe('offline input → no data loss (integration)', () => {
  it('buffers every offline create/update/stop across domains and survives a reload', async () => {
    // 1) A multi-domain, multi-operation offline session. Each call must reject
    //    with the network error — proving the operation was actually attempted
    //    against the (offline) network, not silently swallowed.
    await expect(
      feedingApi.createFeedingEventOptimistic(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        feedingType: 'BOTTLE',
        amountMl: 90,
      }),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(
      diaperApi.createDiaperEventOptimistic(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        diaperType: 'STOOL',
      }),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(
      sleepApi.createSleepEventOptimistic(HOUSEHOLD_ID, CHILD_ID, USER_ID, {
        startedAt: SLEEP_STARTED_AT,
      }),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(
      feedingApi.updateFeedingEventOptimistic(HOUSEHOLD_ID, CHILD_ID, existingBottleFeeding, {
        amountMl: 150,
        clientTimestamp: '2026-01-01T10:15:00.000Z',
      }),
    ).rejects.toBeInstanceOf(TypeError);

    await expect(
      feedingApi.stopFeedingTimerOptimistic(
        HOUSEHOLD_ID,
        CHILD_ID,
        activeBreastFeeding,
        STOP_TIMESTAMP,
      ),
    ).rejects.toBeInstanceOf(TypeError);

    // 2) Durability now: read straight from IndexedDB, not React state.
    assertAllFiveRecords(await db.listAllPendingEvents());

    // 3) Simulated reload: reset only the module registry (NOT the IDBFactory —
    //    that would defeat the point), so `pendingEvents.db` reopens a brand-new
    //    connection against the same stored data. This is the crux: it proves
    //    durability through IndexedDB's real storage, not in-memory module state.
    vi.resetModules();
    const reloadedDb = await import('./pendingEvents.db');
    assertAllFiveRecords(await reloadedDb.listAllPendingEvents());
  });
});
