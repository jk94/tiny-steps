import type { TimelineEventSummary } from '../api/event-api';
import type { LocalEventStatus } from './pendingEvents.db';

/**
 * A locally-buffered event handed to the merge: the summary to render plus its
 * buffer status, so the merged output can flag not-yet-confirmed rows.
 */
export interface PendingTimelineEvent<T extends TimelineEventSummary = TimelineEventSummary> {
  summary: T;
  status: LocalEventStatus;
}

/**
 * One row of the merged timeline. `localStatus` is set only for rows that came
 * from the local IndexedDB buffer and haven't been confirmed by the server yet
 * (`pending` = in flight, `failed` = its create round-trip failed); it is
 * `undefined` for authoritative server rows. This lets the UI mark a `failed`
 * row distinctly so the user isn't misled into thinking it was saved.
 */
export interface MergedTimelineEvent<T extends TimelineEventSummary = TimelineEventSummary> {
  summary: T;
  localStatus?: LocalEventStatus;
}

/**
 * Merges the authoritative server events with the locally-buffered pending ones
 * and re-sorts by `occurredAt`. A pending event whose `id` already appears among
 * the server events is dropped — this is what makes the optimistic row disappear
 * cleanly the moment its real server row arrives (after the buffered copy's
 * delete + refetch), without a flash of the entry appearing twice. Sorting is
 * this function's sole responsibility; callers must not rely on the input order.
 */
export function mergeServerAndPendingEvents<T extends TimelineEventSummary>(
  serverEvents: T[],
  pendingEvents: PendingTimelineEvent<T>[],
  order: 'asc' | 'desc',
): MergedTimelineEvent<T>[] {
  const serverIds = new Set(serverEvents.map((event) => event.id));
  const merged: MergedTimelineEvent<T>[] = [
    ...serverEvents.map((summary) => ({ summary })),
    ...pendingEvents
      .filter((pending) => !serverIds.has(pending.summary.id))
      .map((pending) => ({ summary: pending.summary, localStatus: pending.status })),
  ];
  return merged.sort((a, b) =>
    order === 'asc'
      ? a.summary.occurredAt.localeCompare(b.summary.occurredAt)
      : b.summary.occurredAt.localeCompare(a.summary.occurredAt),
  );
}
