import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedingEventSummary } from '../api/feeding-api';
import { ApiError } from '../api/http-client';
import { createEventOptimistically } from './createEventOptimistically';
import * as db from './pendingEvents.db';
import * as pendingQuery from './usePendingLocalEvents';

vi.mock('./pendingEvents.db');
vi.mock('./usePendingLocalEvents');

const mockedDb = vi.mocked(db);
const mockedPendingQuery = vi.mocked(pendingQuery);

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
};

function optimisticSummary(localId: string): FeedingEventSummary {
  return { ...serverSummary, id: localId };
}

describe('createEventOptimistically', () => {
  beforeEach(() => {
    mockedDb.putPendingEvent.mockResolvedValue();
    mockedDb.deletePendingEvent.mockResolvedValue();
    mockedDb.markPendingEventFailed.mockResolvedValue();
    mockedPendingQuery.invalidatePendingEventsQuery.mockResolvedValue();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('buffers the event in IndexedDB before firing the API call', async () => {
    const apiCall = vi.fn().mockResolvedValue(serverSummary);

    await createEventOptimistically({
      householdId: HOUSEHOLD_ID,
      childId: CHILD_ID,
      eventType: 'FEEDING',
      buildOptimisticSummary: optimisticSummary,
      apiCall,
    });

    const putOrder = mockedDb.putPendingEvent.mock.invocationCallOrder[0];
    const apiOrder = apiCall.mock.invocationCallOrder[0];
    expect(putOrder).toBeLessThan(apiOrder);

    const buffered = mockedDb.putPendingEvent.mock.calls[0][0];
    expect(buffered.status).toBe('pending');
    expect(buffered.localId).toMatch(/^local-/);
    expect(buffered.summary.id).toBe(buffered.localId);
  });

  it('deletes the buffered copy and returns the server summary on success', async () => {
    const apiCall = vi.fn().mockResolvedValue(serverSummary);

    const result = await createEventOptimistically({
      householdId: HOUSEHOLD_ID,
      childId: CHILD_ID,
      eventType: 'FEEDING',
      buildOptimisticSummary: optimisticSummary,
      apiCall,
    });

    expect(result).toBe(serverSummary);
    const bufferedLocalId = mockedDb.putPendingEvent.mock.calls[0][0].localId;
    expect(mockedDb.deletePendingEvent).toHaveBeenCalledWith(bufferedLocalId);
    expect(mockedDb.markPendingEventFailed).not.toHaveBeenCalled();
  });

  it('marks the buffered copy failed, keeps it, and rethrows the original error on failure', async () => {
    const error = new ApiError(500, {});
    const apiCall = vi.fn().mockRejectedValue(error);

    await expect(
      createEventOptimistically({
        householdId: HOUSEHOLD_ID,
        childId: CHILD_ID,
        eventType: 'FEEDING',
        buildOptimisticSummary: optimisticSummary,
        apiCall,
      }),
    ).rejects.toBe(error);

    const bufferedLocalId = mockedDb.putPendingEvent.mock.calls[0][0].localId;
    expect(mockedDb.markPendingEventFailed).toHaveBeenCalledWith(bufferedLocalId);
    expect(mockedDb.deletePendingEvent).not.toHaveBeenCalled();
  });
});
