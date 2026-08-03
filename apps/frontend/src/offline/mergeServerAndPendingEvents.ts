import type { TimelineEventSummary } from '../api/event-api';

/**
 * Merges the authoritative server events with the locally-buffered pending ones
 * and re-sorts by `occurredAt`. A pending event whose `id` already appears among
 * the server events is dropped — this is what makes the optimistic row disappear
 * cleanly the moment its real server row arrives (after the buffered copy's
 * delete + refetch), without a flash of the entry appearing twice.
 */
export function mergeServerAndPendingEvents<T extends TimelineEventSummary>(
  serverEvents: T[],
  pendingEvents: TimelineEventSummary[],
  order: 'asc' | 'desc',
): TimelineEventSummary[] {
  const serverIds = new Set(serverEvents.map((event) => event.id));
  const stillPending = pendingEvents.filter((event) => !serverIds.has(event.id));
  return [...serverEvents, ...stillPending].sort((a, b) =>
    order === 'asc'
      ? a.occurredAt.localeCompare(b.occurredAt)
      : b.occurredAt.localeCompare(a.occurredAt),
  );
}
