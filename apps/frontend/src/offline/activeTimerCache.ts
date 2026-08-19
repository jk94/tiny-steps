import { EVENT_TYPE_QUERY_KEY_SEGMENT, type EventType } from '../api/event-api';
import { queryClient } from '../lib/query-client';

/**
 * Query key for a household+child's "active-timer" query (FEEDING/SLEEP only —
 * see `fetchActiveFeedingTimer`/`fetchActiveSleepTimer`). Shared by
 * `FeedingHome`/`SleepHome` (the query owner) and this module (which writes to
 * it directly after a confirmed stop).
 */
function activeTimerQueryKey(householdId: string, childId: string, eventType: EventType) {
  const segment = EVENT_TYPE_QUERY_KEY_SEGMENT[eventType];
  return ['households', householdId, 'children', childId, segment, 'active-timer'] as const;
}

/**
 * Authoritatively marks a household+child's active-timer query as "no timer
 * running" once a stop is confirmed (server success, or an idempotent
 * `EVENT_ALREADY_STOPPED` — both mean the desired end state already holds).
 *
 * Deliberately does *not* rely on `invalidateQueries` for this specific query,
 * unlike the broader per-domain list invalidation elsewhere in this codebase.
 * `invalidateQueries` only *schedules* a refetch and can lose a race against an
 * unrelated fetch for the very same key that was already in flight when it
 * runs — e.g. one kicked off moments earlier by `RealtimeProvider`'s broad
 * `['households']` invalidation on a WebSocket `connect` (which fires on every
 * reconnect, not just recovery-from-offline), or by its `event:changed`
 * broadcast handler. If that pre-existing fetch resolves *after* our own
 * invalidate/refetch, it silently overwrites the query with stale "still
 * running" data — `FeedingTimer`/`SleepTimer` then keeps ticking against a
 * `startedAt` the user already stopped, even though nothing about *our own*
 * request ordering was wrong. This is what caused the flicker/stuck-timer bug
 * to persist even after `updateEventOptimistically`'s and `syncQueue`'s
 * domain-invalidate-before-pending-delete ordering fix.
 *
 * The fix is the standard TanStack Query "optimistic update" recipe — cancel,
 * then `setQueryData` — applied to a value we *know* for certain (there is no
 * active timer right after a confirmed stop) rather than to a client-guessed
 * one: `cancelQueries` aborts/ignores any in-flight fetch for this key, so its
 * eventual resolution (even if the underlying network call isn't actually
 * abortable) can no longer clobber the write that follows.
 */
export async function clearActiveTimerCache(
  householdId: string,
  childId: string,
  eventType: EventType,
): Promise<void> {
  const key = activeTimerQueryKey(householdId, childId, eventType);
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueryData(key, null);
}
