import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { FeedingEventSummary } from '../api/feeding-api';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';
import * as conflictNotices from './conflictNotices';
import * as db from './pendingEvents.db';
import { updateEventOptimistically } from './updateEventOptimistically';
import * as pendingQuery from './usePendingLocalEvents';

vi.mock('./pendingEvents.db');
vi.mock('./usePendingLocalEvents');
vi.mock('./conflictNotices');

const mockedDb = vi.mocked(db);
const mockedPendingQuery = vi.mocked(pendingQuery);
const mockedConflictNotices = vi.mocked(conflictNotices);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const TARGET_EVENT_ID = 'server-1';

const summary: FeedingEventSummary = {
  id: TARGET_EVENT_ID,
  childId: CHILD_ID,
  userId: 'u1',
  type: 'FEEDING',
  feedingType: 'BOTTLE',
  occurredAt: '2026-01-01T10:00:00.000Z',
  startedAt: null,
  endedAt: null,
  durationSeconds: null,
  side: null,
  amountMl: 120,
  note: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

const UPDATE_INPUT = { amountMl: 120, clientTimestamp: '2026-01-01T11:00:00.000Z' };

function run(apiCall: () => Promise<FeedingEventSummary>) {
  return updateEventOptimistically({
    householdId: HOUSEHOLD_ID,
    childId: CHILD_ID,
    eventType: 'FEEDING',
    targetEventId: TARGET_EVENT_ID,
    operation: 'update',
    buildOptimisticSummary: () => summary,
    apiCall,
    updateInput: UPDATE_INPUT,
  });
}

function runStop(apiCall: () => Promise<FeedingEventSummary>) {
  return updateEventOptimistically({
    householdId: HOUSEHOLD_ID,
    childId: CHILD_ID,
    eventType: 'FEEDING',
    targetEventId: TARGET_EVENT_ID,
    operation: 'stop',
    buildOptimisticSummary: () => summary,
    apiCall,
    updateInput: UPDATE_INPUT,
  });
}

let invalidateQueriesSpy: MockInstance;

describe('updateEventOptimistically', () => {
  beforeEach(() => {
    mockedDb.putPendingEvent.mockResolvedValue();
    mockedDb.deletePendingEvent.mockResolvedValue();
    mockedDb.markPendingEventFailed.mockResolvedValue();
    mockedDb.findPendingUpdateForEvent.mockResolvedValue(undefined);
    mockedPendingQuery.invalidatePendingEventsQuery.mockResolvedValue();
    invalidateQueriesSpy = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('buffers the write (as an update/target-bearing record) before firing the API call', async () => {
    const apiCall = vi.fn().mockResolvedValue(summary);

    await run(apiCall);

    const putOrder = mockedDb.putPendingEvent.mock.invocationCallOrder[0];
    const apiOrder = apiCall.mock.invocationCallOrder[0];
    expect(putOrder).toBeLessThan(apiOrder);

    const buffered = mockedDb.putPendingEvent.mock.calls[0][0];
    expect(buffered.operation).toBe('update');
    expect(buffered.targetEventId).toBe(TARGET_EVENT_ID);
    expect(buffered.updateInput).toBe(UPDATE_INPUT);
    expect(buffered.status).toBe('pending');
    expect(buffered.localId).toMatch(/^local-/);
  });

  it('deletes the buffered copy and invalidates pending + domain queries on success', async () => {
    const apiCall = vi.fn().mockResolvedValue(summary);

    await run(apiCall);

    const localId = mockedDb.putPendingEvent.mock.calls[0][0].localId;
    expect(mockedDb.deletePendingEvent).toHaveBeenCalledWith(localId);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'feeding-events'],
    });
    expect(mockedConflictNotices.recordConflictNotice).not.toHaveBeenCalled();
  });

  it('keeps the edited values (marks failed, no delete) and rethrows on an ordinary failure', async () => {
    const error = new ApiError(500, {});
    const apiCall = vi.fn().mockRejectedValue(error);

    await expect(run(apiCall)).rejects.toBe(error);

    const localId = mockedDb.putPendingEvent.mock.calls[0][0].localId;
    expect(mockedDb.markPendingEventFailed).toHaveBeenCalledWith(localId);
    expect(mockedDb.deletePendingEvent).not.toHaveBeenCalled();
    expect(mockedConflictNotices.recordConflictNotice).not.toHaveBeenCalled();
  });

  it('on an EVENT_CONFLICT deletes the record, records a notice, invalidates the domain query, and rethrows', async () => {
    const conflict = new ApiError(409, { code: 'EVENT_CONFLICT', currentEvent: summary });
    const apiCall = vi.fn().mockRejectedValue(conflict);

    await expect(run(apiCall)).rejects.toBe(conflict);

    const localId = mockedDb.putPendingEvent.mock.calls[0][0].localId;
    expect(mockedDb.deletePendingEvent).toHaveBeenCalledWith(localId);
    expect(mockedDb.markPendingEventFailed).not.toHaveBeenCalled();
    expect(mockedConflictNotices.recordConflictNotice).toHaveBeenCalledWith(
      'FEEDING',
      TARGET_EVENT_ID,
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'feeding-events'],
    });
  });

  it('reuses an existing pending record’s localId for a second edit of the same event (JC-4)', async () => {
    mockedDb.findPendingUpdateForEvent.mockResolvedValue({
      localId: 'local-existing',
      householdId: HOUSEHOLD_ID,
      childId: CHILD_ID,
      eventType: 'FEEDING',
      status: 'failed',
      savedAt: '2026-01-01T10:30:00.000Z',
      summary,
      operation: 'update',
      targetEventId: TARGET_EVENT_ID,
      updateInput: { amountMl: 90 },
    });
    const apiCall = vi.fn().mockResolvedValue(summary);

    await run(apiCall);

    expect(mockedDb.putPendingEvent.mock.calls[0][0].localId).toBe('local-existing');
    // Exactly one record is written — no duplicate is queued.
    expect(mockedDb.putPendingEvent).toHaveBeenCalledTimes(1);
  });

  it('invalidates the domain query before dropping the pending overlay on success (avoids the timer-flicker race)', async () => {
    const apiCall = vi.fn().mockResolvedValue(summary);
    const callOrder: string[] = [];
    invalidateQueriesSpy.mockImplementation(() => {
      callOrder.push('invalidateDomainQuery');
      return Promise.resolve();
    });
    mockedDb.deletePendingEvent.mockImplementation(() => {
      callOrder.push('deletePendingEvent');
      return Promise.resolve();
    });

    await run(apiCall);

    expect(callOrder).toEqual(['invalidateDomainQuery', 'deletePendingEvent']);
  });

  it('on a stop success, authoritatively clears the active-timer cache (cancel + null) before dropping the pending overlay', async () => {
    const apiCall = vi.fn().mockResolvedValue(summary);
    const cancelQueriesSpy = vi
      .spyOn(queryClient, 'cancelQueries')
      .mockResolvedValue(undefined as never);
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const callOrder: string[] = [];
    cancelQueriesSpy.mockImplementation(() => {
      callOrder.push('cancelActiveTimer');
      return Promise.resolve();
    });
    mockedDb.deletePendingEvent.mockImplementation(() => {
      callOrder.push('deletePendingEvent');
      return Promise.resolve();
    });

    await runStop(apiCall);

    const activeTimerKey = [
      'households',
      HOUSEHOLD_ID,
      'children',
      CHILD_ID,
      'feeding-events',
      'active-timer',
    ];
    expect(cancelQueriesSpy).toHaveBeenCalledWith({ queryKey: activeTimerKey });
    expect(setQueryDataSpy).toHaveBeenCalledWith(activeTimerKey, null);
    expect(callOrder).toEqual(['cancelActiveTimer', 'deletePendingEvent']);
  });

  it('does not touch the active-timer cache for a plain update operation', async () => {
    const apiCall = vi.fn().mockResolvedValue(summary);
    const cancelQueriesSpy = vi
      .spyOn(queryClient, 'cancelQueries')
      .mockResolvedValue(undefined as never);
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    await run(apiCall);

    expect(cancelQueriesSpy).not.toHaveBeenCalled();
    expect(setQueryDataSpy).not.toHaveBeenCalled();
  });

  it('on a redundant EVENT_ALREADY_STOPPED for a stop operation, drops the record, refetches the domain query, records no notice, and rethrows', async () => {
    const alreadyStopped = new ApiError(409, {
      code: 'EVENT_ALREADY_STOPPED',
      currentEvent: summary,
    });
    const apiCall = vi.fn().mockRejectedValue(alreadyStopped);

    await expect(runStop(apiCall)).rejects.toBe(alreadyStopped);

    const localId = mockedDb.putPendingEvent.mock.calls[0][0].localId;
    expect(mockedDb.deletePendingEvent).toHaveBeenCalledWith(localId);
    expect(mockedDb.markPendingEventFailed).not.toHaveBeenCalled();
    expect(mockedConflictNotices.recordConflictNotice).not.toHaveBeenCalled();
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'feeding-events'],
    });
  });

  it('does not treat an EVENT_ALREADY_STOPPED error as redundant for a plain update operation', async () => {
    const alreadyStopped = new ApiError(409, {
      code: 'EVENT_ALREADY_STOPPED',
      currentEvent: summary,
    });
    const apiCall = vi.fn().mockRejectedValue(alreadyStopped);

    await expect(run(apiCall)).rejects.toBe(alreadyStopped);

    const localId = mockedDb.putPendingEvent.mock.calls[0][0].localId;
    expect(mockedDb.markPendingEventFailed).toHaveBeenCalledWith(localId);
    expect(mockedDb.deletePendingEvent).not.toHaveBeenCalled();
  });
});
