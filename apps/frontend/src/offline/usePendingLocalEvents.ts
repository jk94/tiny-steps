import { useQuery } from '@tanstack/react-query';
import type { EventType } from '../api/event-api';
import { queryClient } from '../lib/query-client';
import { listPendingEvents } from './pendingEvents.db';

/**
 * Query key for the IndexedDB-backed "pending local events" query. The
 * unfiltered variant (no `eventType`) is a strict prefix of every type-filtered
 * variant, so invalidating the unfiltered key with TanStack Query's default
 * prefix-matching (`exact: false`) also refreshes all type-filtered consumers.
 */
function pendingLocalEventsQueryKey(householdId: string, childId: string, eventType?: EventType) {
  const base = ['offline', 'pending-events', householdId, childId] as const;
  return eventType ? [...base, eventType] : base;
}

/**
 * Invalidates the unfiltered pending-events key, which — via prefix-matching —
 * refreshes every mounted consumer (per-type lists and the untyped timeline)
 * for this household+child in a single call.
 */
export function invalidatePendingEventsQuery(householdId: string, childId: string): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: pendingLocalEventsQueryKey(householdId, childId),
  });
}

/**
 * Reads the locally-buffered (not-yet-server-confirmed) events for a
 * household+child from IndexedDB, optionally narrowed to one `eventType`. List
 * components merge this into their server-backed query at render time (see
 * `mergeServerAndPendingEvents`) rather than mutating the server query's cache,
 * to avoid races with in-flight/future refetches.
 */
export function usePendingLocalEvents(householdId: string, childId: string, eventType?: EventType) {
  return useQuery({
    queryKey: pendingLocalEventsQueryKey(householdId, childId, eventType),
    queryFn: () => listPendingEvents(householdId, childId, eventType),
    retry: false,
  });
}
