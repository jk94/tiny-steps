import { afterEach, describe, expect, it } from 'vitest';
import { queryClient } from '../lib/query-client';
import { clearActiveTimerCache } from './activeTimerCache';

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const ACTIVE_TIMER_KEY = [
  'households',
  HOUSEHOLD_ID,
  'children',
  CHILD_ID,
  'feeding-events',
  'active-timer',
] as const;

/**
 * Deliberately exercises the real `queryClient` (no `invalidateQueries`
 * mocking, unlike `updateEventOptimistically.spec.ts`) — the regression this
 * guards against is specifically about TanStack Query's own fetch-vs-cache
 * race, which a mocked `queryClient` can't reproduce.
 */
describe('clearActiveTimerCache', () => {
  afterEach(() => {
    queryClient.clear();
  });

  it('writes null into the active-timer query cache', async () => {
    queryClient.setQueryData(ACTIVE_TIMER_KEY, { id: 'evt1', endedAt: null });

    await clearActiveTimerCache(HOUSEHOLD_ID, CHILD_ID, 'FEEDING');

    expect(queryClient.getQueryData(ACTIVE_TIMER_KEY)).toBeNull();
  });

  it('is immune to a stale in-flight fetch for the same query resolving afterwards', async () => {
    let resolveStaleFetch: (value: unknown) => void = () => {};
    const staleFetchResult = new Promise((resolve) => {
      resolveStaleFetch = resolve;
    });

    // Simulate a fetch that was already in flight *before* our stop was
    // confirmed — e.g. one kicked off by RealtimeProvider's broad
    // `['households']` invalidation on an incidental WebSocket reconnect.
    const staleFetch = queryClient.fetchQuery({
      queryKey: ACTIVE_TIMER_KEY,
      queryFn: () => staleFetchResult,
    });
    // Let the fetch register as in-flight before we cancel it.
    await new Promise((resolve) => setTimeout(resolve, 0));

    await clearActiveTimerCache(HOUSEHOLD_ID, CHILD_ID, 'FEEDING');
    expect(queryClient.getQueryData(ACTIVE_TIMER_KEY)).toBeNull();

    // The stale fetch now resolves with old "still running" data — without
    // the `cancelQueries` call, this would silently overwrite our null.
    resolveStaleFetch({ id: 'evt1', endedAt: null, startedAt: '2026-01-01T10:00:00.000Z' });
    await staleFetch.catch(() => {
      // Expected: a cancelled query's `fetchQuery` promise rejects.
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(queryClient.getQueryData(ACTIVE_TIMER_KEY)).toBeNull();
  });
});
