import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateFeedingEventOptimistic } from '../api/feeding-api';
import type { FeedingEventSummary } from '../api/feeding-api';
import * as httpClient from '../api/http-client';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';
import { deletePendingEvent, listAllPendingEvents } from './pendingEvents.db';
import { drainPendingEventQueue } from './syncQueue';

// Only the network seam is mocked; the IndexedDB layer, the optimistic engine,
// the sync-queue and the conflict-notice store all run for real (against the
// global fake-indexeddb), so this proves the buffered-edit → conflict → resolve
// lifecycle end to end — see ADR-0011.
vi.mock('../api/http-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/http-client')>();
  return { ...actual, apiFetch: vi.fn() };
});

const mockedFetch = vi.mocked(httpClient.apiFetch);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

const current: FeedingEventSummary = {
  id: 'server-1',
  childId: CHILD_ID,
  userId: 'u1',
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

const CONFLICT_NOTICES_KEY = ['offline', 'conflict-notices'];

describe('offline edit → conflict → resolve (integration)', () => {
  beforeEach(async () => {
    for (const record of await listAllPendingEvents()) {
      await deletePendingEvent(record.localId);
    }
    queryClient.clear();
    mockedFetch.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('buffers an offline edit, then resolves it as a conflict on reconnect', async () => {
    // 1) Edit while offline: the PATCH fails, the edit is kept as a failed
    //    update record (never reverted to stale values).
    mockedFetch.mockRejectedValueOnce(new TypeError('offline'));
    await expect(
      updateFeedingEventOptimistic(HOUSEHOLD_ID, CHILD_ID, current, {
        amountMl: 150,
        clientTimestamp: '2026-01-01T11:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(TypeError);

    let records = await listAllPendingEvents();
    expect(records).toHaveLength(1);
    expect(records[0].operation).toBe('update');
    expect(records[0].targetEventId).toBe('server-1');
    expect(records[0].status).toBe('failed');
    // The edited value is what's shown (JC-2).
    expect((records[0].summary as FeedingEventSummary).amountMl).toBe(150);

    // 2) Reconnect: the server now reports a Last-Write-Wins conflict. The
    //    buffered edit is dropped (it lost) and a notice is recorded.
    mockedFetch.mockRejectedValueOnce(
      new ApiError(409, { code: 'EVENT_CONFLICT', currentEvent: current }),
    );
    await drainPendingEventQueue();

    records = await listAllPendingEvents();
    expect(records).toHaveLength(0);

    const notices = queryClient.getQueryData<{ targetEventId: string }[]>(CONFLICT_NOTICES_KEY);
    expect(notices).toHaveLength(1);
    expect(notices?.[0].targetEventId).toBe('server-1');
  });

  it('buffers an offline edit and confirms it cleanly when the reconnect succeeds', async () => {
    mockedFetch.mockRejectedValueOnce(new TypeError('offline'));
    await expect(
      updateFeedingEventOptimistic(HOUSEHOLD_ID, CHILD_ID, current, {
        note: 'later',
        clientTimestamp: '2026-01-01T11:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(await listAllPendingEvents()).toHaveLength(1);

    // Reconnect: the PATCH now succeeds, so the buffered copy is removed and no
    // conflict notice is raised.
    mockedFetch.mockResolvedValueOnce({ ...current, note: 'later' });
    await drainPendingEventQueue();

    expect(await listAllPendingEvents()).toHaveLength(0);
    expect(queryClient.getQueryData(CONFLICT_NOTICES_KEY) ?? []).toHaveLength(0);
  });
});
