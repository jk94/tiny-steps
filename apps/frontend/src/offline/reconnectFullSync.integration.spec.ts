import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { DiaperEventSummary } from '../api/diaper-api';
import type { FeedingEventSummary } from '../api/feeding-api';
import type { SleepEventSummary } from '../api/sleep-api';
import type { PendingEventRecord } from './pendingEvents.db';

// The IndexedDB layer and the sync-queue drain run for real (against a fresh
// fake-indexeddb per test); only the per-domain create/update/stop functions are
// mocked, so each call can be sequenced independently (needed for the
// fails-once-then-succeeds record). This proves "all offline-recorded entries
// sync correctly after reconnect" across all three domains and all three
// operation types (roadmap Phase 4).
vi.mock('../api/feeding-api');
vi.mock('../api/sleep-api');
vi.mock('../api/diaper-api');

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const USER_ID = 'u1';

const FEEDING_CREATE_INPUT = { feedingType: 'BOTTLE' as const, amountMl: 120 };
const SLEEP_CREATE_INPUT = { startedAt: '2026-01-01T09:00:00.000Z' };
const FEEDING_UPDATE_TARGET = 'server-feed-1';
const FEEDING_UPDATE_INPUT = { amountMl: 150, clientTimestamp: '2026-01-01T11:00:00.000Z' };
const SLEEP_STOP_TARGET = 'server-sleep-1';
const SLEEP_STOP_INPUT = { clientTimestamp: '2026-01-01T11:30:00.000Z' };
const DIAPER_CREATE_INPUT = { diaperType: 'PEE' as const };

const feedingSummary: FeedingEventSummary = {
  id: FEEDING_UPDATE_TARGET,
  childId: CHILD_ID,
  userId: USER_ID,
  type: 'FEEDING',
  feedingType: 'BOTTLE',
  occurredAt: '2026-01-01T10:00:00.000Z',
  startedAt: null,
  endedAt: null,
  durationSeconds: null,
  side: null,
  amountMl: 150,
  note: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T11:00:00.000Z',
};

const sleepSummary: SleepEventSummary = {
  id: SLEEP_STOP_TARGET,
  childId: CHILD_ID,
  userId: USER_ID,
  type: 'SLEEP',
  occurredAt: '2026-01-01T09:00:00.000Z',
  startedAt: '2026-01-01T09:00:00.000Z',
  endedAt: '2026-01-01T11:30:00.000Z',
  durationSeconds: 9000,
  createdAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-01T11:30:00.000Z',
};

const diaperSummary: DiaperEventSummary = {
  id: 'server-diaper-1',
  childId: CHILD_ID,
  userId: USER_ID,
  type: 'DIAPER',
  diaperType: 'PEE',
  occurredAt: '2026-01-01T12:00:00.000Z',
  note: null,
  createdAt: '2026-01-01T12:00:00.000Z',
  updatedAt: '2026-01-01T12:00:00.000Z',
};

/** Builds a buffered record shaped exactly like the optimistic engines persist. */
function buildRecord(overrides: Partial<PendingEventRecord> & Pick<PendingEventRecord, 'localId'>) {
  return {
    householdId: HOUSEHOLD_ID,
    childId: CHILD_ID,
    eventType: 'FEEDING' as const,
    status: 'failed' as const,
    summary: feedingSummary,
    ...overrides,
  } as PendingEventRecord;
}

// The db module memoizes its open-connection promise, so a fresh IDBFactory
// alone wouldn't isolate tests — reset the module registry and re-import db,
// syncQueue and the mocked domain APIs together so they bind to the same fresh
// db instance the test seeds through. `ApiError` is imported from the same
// freshly-reset http-client so `instanceof ApiError` inside the drain matches.
let db: typeof import('./pendingEvents.db');
let syncQueue: typeof import('./syncQueue');
let feedingApi: typeof import('../api/feeding-api');
let sleepApi: typeof import('../api/sleep-api');
let diaperApi: typeof import('../api/diaper-api');
let ApiError: typeof import('../api/http-client').ApiError;

/**
 * Drives the real `setImmediate` macrotask queue so IndexedDB work started
 * inside the sync-queue's *self-rescheduled* retry timer (which we fire via
 * fake `setTimeout`) can actually settle. `setImmediate` is deliberately left
 * un-faked (see `beforeEach`): fake-indexeddb schedules its transactions on it,
 * so faking it would deadlock every `await db.*` call.
 */
const setImmediateFn = (globalThis as unknown as { setImmediate: (cb: () => void) => void })
  .setImmediate;

async function flushRealMacrotasks(cycles = 20): Promise<void> {
  for (let i = 0; i < cycles; i += 1) {
    await new Promise<void>((resolve) => setImmediateFn(() => resolve()));
  }
}

beforeEach(async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.resetModules();
  // Fake only the wall clock and `setTimeout` (the sync-queue's retry timer), NOT
  // `setImmediate`: fake-indexeddb runs its transactions on `setImmediate`, so
  // faking it would hang every IndexedDB call. `Date` must be faked so advancing
  // the retry timer also makes the record's `nextRetryAt` due on the next drain.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  db = await import('./pendingEvents.db');
  syncQueue = await import('./syncQueue');
  feedingApi = await import('../api/feeding-api');
  sleepApi = await import('../api/sleep-api');
  diaperApi = await import('../api/diaper-api');
  ({ ApiError } = await import('../api/http-client'));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('reconnect → full multi-domain sync (integration)', () => {
  it('drains every buffered domain/operation, retrying a 5xx via the real self-scheduled timer', async () => {
    // Seed five buffered records directly (bypassing the optimistic engines —
    // this test is about the drain, not the buffering) spanning all three
    // domains and all three operation types.
    await db.putPendingEvent(
      buildRecord({
        localId: 'local-feed-create',
        eventType: 'FEEDING',
        savedAt: '2026-01-01T10:00:00.000Z',
        createInput: FEEDING_CREATE_INPUT,
      }),
    );
    await db.putPendingEvent(
      buildRecord({
        localId: 'local-sleep-create',
        eventType: 'SLEEP',
        savedAt: '2026-01-01T10:00:01.000Z',
        summary: sleepSummary,
        createInput: SLEEP_CREATE_INPUT,
      }),
    );
    await db.putPendingEvent(
      buildRecord({
        localId: 'local-feed-update',
        eventType: 'FEEDING',
        savedAt: '2026-01-01T10:00:02.000Z',
        operation: 'update',
        targetEventId: FEEDING_UPDATE_TARGET,
        updateInput: FEEDING_UPDATE_INPUT,
      }),
    );
    await db.putPendingEvent(
      buildRecord({
        localId: 'local-sleep-stop',
        eventType: 'SLEEP',
        savedAt: '2026-01-01T10:00:03.000Z',
        summary: sleepSummary,
        operation: 'stop',
        targetEventId: SLEEP_STOP_TARGET,
        updateInput: SLEEP_STOP_INPUT,
      }),
    );
    await db.putPendingEvent(
      buildRecord({
        localId: 'local-diaper-create',
        eventType: 'DIAPER',
        savedAt: '2026-01-01T10:00:04.000Z',
        summary: diaperSummary,
        createInput: DIAPER_CREATE_INPUT,
      }),
    );

    vi.mocked(feedingApi.createFeedingEvent).mockResolvedValueOnce(feedingSummary);
    vi.mocked(sleepApi.createSleepEvent).mockResolvedValueOnce(sleepSummary);
    vi.mocked(feedingApi.updateFeedingEvent).mockResolvedValueOnce(feedingSummary);
    vi.mocked(sleepApi.stopSleepTimer).mockResolvedValueOnce(sleepSummary);
    // The diaper create fails once (5xx) then succeeds on the built-in retry.
    vi.mocked(diaperApi.createDiaperEvent)
      .mockRejectedValueOnce(new ApiError(503, {}))
      .mockResolvedValueOnce(diaperSummary);

    // Call the drain directly. The `online`-event-to-drain wiring is already
    // covered by `SyncQueueProvider.spec.tsx`; this test is deliberately scoped
    // to whether the drain itself syncs every buffered record.
    await syncQueue.drainPendingEventQueue();

    // The four non-failing records synced, each via its plain per-operation
    // function with the correct household/child/event-id and payload.
    expect(feedingApi.createFeedingEvent).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      FEEDING_CREATE_INPUT,
    );
    expect(sleepApi.createSleepEvent).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      SLEEP_CREATE_INPUT,
    );
    expect(feedingApi.updateFeedingEvent).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      FEEDING_UPDATE_TARGET,
      FEEDING_UPDATE_INPUT,
    );
    expect(sleepApi.stopSleepTimer).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      SLEEP_STOP_TARGET,
      SLEEP_STOP_INPUT.clientTimestamp,
    );

    // Those four are gone; the diaper record is still buffered, failed, with one
    // retry recorded and a future retry scheduled.
    let remaining = await db.listAllPendingEvents();
    expect(remaining).toHaveLength(1);
    const [diaperRecord] = remaining;
    expect(diaperRecord.localId).toBe('local-diaper-create');
    expect(diaperRecord.status).toBe('failed');
    expect(diaperRecord.retryCount).toBe(1);
    expect(diaperRecord.nextRetryAt).toBeDefined();

    // Advance past the scheduled retry so the sync-queue's OWN self-rescheduled
    // timer fires and re-invokes the drain internally — exercising the real
    // production retry path rather than a manual second drain call.
    const delay = Date.parse(diaperRecord.nextRetryAt as string) - Date.now();
    await vi.advanceTimersByTimeAsync(delay + 50);
    // The fired timer kicked off a fresh drain whose IndexedDB work runs on the
    // real `setImmediate` queue — let it settle before asserting.
    await flushRealMacrotasks();

    // The diaper create was retried and succeeded; nothing is left buffered or
    // still scheduled.
    expect(diaperApi.createDiaperEvent).toHaveBeenCalledTimes(2);
    remaining = await db.listAllPendingEvents();
    expect(remaining).toEqual([]);
  });
});
