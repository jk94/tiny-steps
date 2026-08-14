import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import * as feedingApi from '../api/feeding-api';
import type { FeedingEventSummary } from '../api/feeding-api';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';
import * as conflictNotices from './conflictNotices';
import * as db from './pendingEvents.db';
import type { PendingEventRecord } from './pendingEvents.db';
import { drainPendingEventQueue } from './syncQueue';
import * as pendingQuery from './usePendingLocalEvents';

vi.mock('./pendingEvents.db');
vi.mock('./usePendingLocalEvents');
vi.mock('./conflictNotices');
vi.mock('../api/feeding-api');
vi.mock('../api/sleep-api');
vi.mock('../api/diaper-api');

const mockedDb = vi.mocked(db);
const mockedPendingQuery = vi.mocked(pendingQuery);
const mockedConflictNotices = vi.mocked(conflictNotices);
const mockedFeedingApi = vi.mocked(feedingApi);

// Mirrors `MAX_RETRY_ATTEMPTS` in syncQueue.ts — kept local (the constant is a
// private implementation detail) but asserted against so the exhaustion test
// documents the intended cap.
const MAX_RETRY_ATTEMPTS = 6;

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const CREATE_INPUT = { feedingType: 'SOLID' as const };

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

function makeRecord(overrides: Partial<PendingEventRecord> = {}): PendingEventRecord {
  const localId = overrides.localId ?? 'local-1';
  return {
    localId,
    householdId: HOUSEHOLD_ID,
    childId: CHILD_ID,
    eventType: 'FEEDING',
    status: 'failed',
    savedAt: '2026-01-01T10:00:00.000Z',
    summary: { ...serverSummary, id: localId },
    createInput: CREATE_INPUT,
    ...overrides,
  };
}

let invalidateQueriesSpy: MockInstance;

describe('drainPendingEventQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedDb.deletePendingEvent.mockResolvedValue();
    mockedDb.markPendingEventRetryScheduled.mockResolvedValue();
    mockedPendingQuery.invalidatePendingEventsQuery.mockResolvedValue();
    invalidateQueriesSpy = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('deletes the record and invalidates both the pending and the domain query on success', async () => {
    const record = makeRecord();
    mockedDb.listAllPendingEvents.mockResolvedValue([record]);
    mockedFeedingApi.createFeedingEvent.mockResolvedValue(serverSummary);

    await drainPendingEventQueue();

    expect(mockedFeedingApi.createFeedingEvent).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      CREATE_INPUT,
    );
    expect(mockedDb.deletePendingEvent).toHaveBeenCalledWith(record.localId);
    expect(mockedPendingQuery.invalidatePendingEventsQuery).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'feeding-events'],
    });
  });

  it('schedules a future retry with an incremented retryCount on a retryable (network) failure', async () => {
    mockedDb.listAllPendingEvents.mockResolvedValue([makeRecord()]);
    mockedFeedingApi.createFeedingEvent.mockRejectedValue(new TypeError('offline'));
    const before = Date.now();

    await drainPendingEventQueue();

    expect(mockedDb.markPendingEventRetryScheduled).toHaveBeenCalledTimes(1);
    const [localId, retryCount, nextRetryAt] =
      mockedDb.markPendingEventRetryScheduled.mock.calls[0];
    expect(localId).toBe('local-1');
    expect(retryCount).toBe(1);
    expect(nextRetryAt).toBeDefined();
    expect(Date.parse(nextRetryAt!)).toBeGreaterThan(before);
    expect(mockedDb.deletePendingEvent).not.toHaveBeenCalled();
  });

  it('fast-forwards retryCount to the cap on a non-retryable 4xx failure', async () => {
    mockedDb.listAllPendingEvents.mockResolvedValue([makeRecord()]);
    mockedFeedingApi.createFeedingEvent.mockRejectedValue(new ApiError(400, {}));

    await drainPendingEventQueue();

    expect(mockedDb.markPendingEventRetryScheduled).toHaveBeenCalledWith(
      'local-1',
      MAX_RETRY_ATTEMPTS,
    );
    expect(mockedDb.deletePendingEvent).not.toHaveBeenCalled();
  });

  it('stops resending a record once the retry cap is reached across repeated drains', async () => {
    // A single stateful record whose retry bookkeeping the mocked db mutates,
    // with the backoff window treated as always-elapsed so every drain re-tries.
    const record = makeRecord();
    mockedDb.listAllPendingEvents.mockImplementation(async () => [record]);
    mockedDb.markPendingEventRetryScheduled.mockImplementation(async (_localId, retryCount) => {
      record.retryCount = retryCount;
      record.nextRetryAt = undefined;
    });
    mockedFeedingApi.createFeedingEvent.mockRejectedValue(new TypeError('offline'));

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS + 2; attempt += 1) {
      await drainPendingEventQueue();
    }

    expect(mockedFeedingApi.createFeedingEvent).toHaveBeenCalledTimes(MAX_RETRY_ATTEMPTS);
  });

  it('permanently skips a legacy record that has no persisted createInput', async () => {
    mockedDb.listAllPendingEvents.mockResolvedValue([makeRecord({ createInput: undefined })]);

    await drainPendingEventQueue();

    expect(mockedFeedingApi.createFeedingEvent).not.toHaveBeenCalled();
    expect(mockedDb.deletePendingEvent).not.toHaveBeenCalled();
    expect(mockedDb.markPendingEventRetryScheduled).not.toHaveBeenCalled();
  });

  it('keeps draining the remaining due records when one record throws in a non-createEvent step', async () => {
    // Two due records, oldest first. The first resends fine but its IndexedDB
    // delete throws — that must not abort the pass; the second must still run.
    const first = makeRecord({ localId: 'local-1', savedAt: '2026-01-01T09:00:00.000Z' });
    const second = makeRecord({ localId: 'local-2', savedAt: '2026-01-01T10:00:00.000Z' });
    mockedDb.listAllPendingEvents.mockResolvedValue([first, second]);
    mockedFeedingApi.createFeedingEvent.mockResolvedValue(serverSummary);
    mockedDb.deletePendingEvent.mockImplementation(async (localId) => {
      if (localId === 'local-1') {
        throw new Error('IndexedDB delete failed');
      }
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await drainPendingEventQueue();

    // Both records were resent — the first record's post-success failure did
    // not stop the second from being processed.
    expect(mockedFeedingApi.createFeedingEvent).toHaveBeenCalledTimes(2);
    expect(mockedDb.deletePendingEvent).toHaveBeenCalledWith('local-2');
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('resolves (never rejects) and clears the single-flight guard when an internal step throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedDb.listAllPendingEvents.mockRejectedValueOnce(new Error('IndexedDB open failed'));

    // A top-level failure must not surface as an unhandled rejection.
    await expect(drainPendingEventQueue()).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    // The guard was cleared, so a subsequent drain runs a fresh pass rather than
    // being permanently blocked by the earlier failure.
    mockedDb.listAllPendingEvents.mockResolvedValue([]);
    await expect(drainPendingEventQueue()).resolves.toBeUndefined();
    expect(mockedDb.listAllPendingEvents).toHaveBeenCalledTimes(2);
  });

  it('shares a single in-flight run between concurrent callers', async () => {
    let resolveList!: (records: PendingEventRecord[]) => void;
    mockedDb.listAllPendingEvents.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );

    const first = drainPendingEventQueue();
    const second = drainPendingEventQueue();
    expect(first).toBe(second);

    resolveList([]);
    await Promise.all([first, second]);

    expect(mockedDb.listAllPendingEvents).toHaveBeenCalledTimes(1);
  });

  describe('update/stop operations', () => {
    const TARGET_ID = 'server-1';
    const UPDATE_INPUT = { amountMl: 120, clientTimestamp: '2026-01-01T11:00:00.000Z' };
    const STOP_INPUT = { clientTimestamp: '2026-01-01T11:00:00.000Z' };

    function updateRecord(overrides: Partial<PendingEventRecord> = {}): PendingEventRecord {
      return makeRecord({
        localId: 'local-upd',
        operation: 'update',
        targetEventId: TARGET_ID,
        updateInput: UPDATE_INPUT,
        ...overrides,
      });
    }

    it('drains a buffered update via the plain update function and clears it on success', async () => {
      mockedDb.listAllPendingEvents.mockResolvedValue([updateRecord()]);
      mockedFeedingApi.updateFeedingEvent.mockResolvedValue(serverSummary);

      await drainPendingEventQueue();

      expect(mockedFeedingApi.updateFeedingEvent).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        TARGET_ID,
        UPDATE_INPUT,
      );
      expect(mockedDb.deletePendingEvent).toHaveBeenCalledWith('local-upd');
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'feeding-events'],
      });
    });

    it('drains a buffered timer-stop via the plain stop function, forwarding its clientTimestamp', async () => {
      mockedDb.listAllPendingEvents.mockResolvedValue([
        updateRecord({ localId: 'local-stop', operation: 'stop', updateInput: STOP_INPUT }),
      ]);
      mockedFeedingApi.stopFeedingTimer.mockResolvedValue(serverSummary);

      await drainPendingEventQueue();

      expect(mockedFeedingApi.stopFeedingTimer).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        CHILD_ID,
        TARGET_ID,
        STOP_INPUT.clientTimestamp,
      );
      expect(mockedDb.deletePendingEvent).toHaveBeenCalledWith('local-stop');
    });

    it('resolves an EVENT_CONFLICT during drain without scheduling a retry', async () => {
      mockedDb.listAllPendingEvents.mockResolvedValue([updateRecord()]);
      mockedFeedingApi.updateFeedingEvent.mockRejectedValue(
        new ApiError(409, { code: 'EVENT_CONFLICT', currentEvent: serverSummary }),
      );

      await drainPendingEventQueue();

      expect(mockedDb.deletePendingEvent).toHaveBeenCalledWith('local-upd');
      expect(mockedConflictNotices.recordConflictNotice).toHaveBeenCalledWith('FEEDING', TARGET_ID);
      expect(mockedDb.markPendingEventRetryScheduled).not.toHaveBeenCalled();
    });

    it('still retries a buffered update with backoff on a 5xx during drain', async () => {
      mockedDb.listAllPendingEvents.mockResolvedValue([updateRecord()]);
      mockedFeedingApi.updateFeedingEvent.mockRejectedValue(new ApiError(500, {}));

      await drainPendingEventQueue();

      expect(mockedDb.markPendingEventRetryScheduled).toHaveBeenCalledTimes(1);
      const [localId, retryCount, nextRetryAt] =
        mockedDb.markPendingEventRetryScheduled.mock.calls[0];
      expect(localId).toBe('local-upd');
      expect(retryCount).toBe(1);
      expect(nextRetryAt).toBeDefined();
      expect(mockedDb.deletePendingEvent).not.toHaveBeenCalled();
      expect(mockedConflictNotices.recordConflictNotice).not.toHaveBeenCalled();
    });
  });
});
