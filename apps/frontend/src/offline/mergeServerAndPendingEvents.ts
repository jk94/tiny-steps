import type { TimelineEventSummary } from '../api/event-api';
import type { LocalEventStatus } from './pendingEvents.db';

/**
 * A locally-buffered event handed to the merge: the summary to render plus its
 * buffer status, so the merged output can flag not-yet-confirmed rows. For an
 * edit/timer-stop record `operation` and `targetEventId` are set, which makes
 * the merge overlay the matching server row rather than add an extra one.
 */
export interface PendingTimelineEvent<T extends TimelineEventSummary = TimelineEventSummary> {
  summary: T;
  status: LocalEventStatus;
  /** `undefined` for a create (unioned as a new row); `'update'`/`'stop'`
   * overlay the server row identified by `targetEventId`. */
  operation?: 'update' | 'stop';
  /** The server id an `'update'`/`'stop'` record targets. */
  targetEventId?: string;
}

/**
 * One row of the merged timeline. `localStatus` is set only for rows that came
 * from the local IndexedDB buffer and haven't been confirmed by the server yet
 * (`pending` = in flight, `failed` = its round-trip failed); it is `undefined`
 * for untouched authoritative server rows. This lets the UI mark a `failed` row
 * distinctly so the user isn't misled into thinking it was saved.
 */
export interface MergedTimelineEvent<T extends TimelineEventSummary = TimelineEventSummary> {
  summary: T;
  localStatus?: LocalEventStatus;
}

/**
 * Merges the authoritative server events with the locally-buffered pending ones
 * and re-sorts by `occurredAt`. There are two kinds of pending record:
 *
 *  - A create (`operation` unset): unioned as a new row, unless its `id` already
 *    appears among the server events (its confirmed row has arrived) — that's
 *    what makes the optimistic row swap cleanly without a double-render.
 *  - An edit/timer-stop (`operation` set): overlays the server row whose `id`
 *    matches `targetEventId`, replacing that row's rendered summary and carrying
 *    the buffer status, so the edited values show immediately (JC-2). An overlay
 *    with no matching server row is added as a standalone row rather than lost.
 *
 * Sorting is this function's sole responsibility; callers must not rely on the
 * input order.
 */
export function mergeServerAndPendingEvents<T extends TimelineEventSummary>(
  serverEvents: T[],
  pendingEvents: PendingTimelineEvent<T>[],
  order: 'asc' | 'desc',
): MergedTimelineEvent<T>[] {
  const overlays = new Map<string, PendingTimelineEvent<T>>();
  const creates: PendingTimelineEvent<T>[] = [];
  for (const pending of pendingEvents) {
    if (pending.operation !== undefined && pending.targetEventId !== undefined) {
      overlays.set(pending.targetEventId, pending);
    } else {
      creates.push(pending);
    }
  }

  const serverIds = new Set(serverEvents.map((event) => event.id));
  const merged: MergedTimelineEvent<T>[] = [];

  for (const summary of serverEvents) {
    const overlay = overlays.get(summary.id);
    merged.push(overlay ? { summary: overlay.summary, localStatus: overlay.status } : { summary });
  }

  // Overlays with no matching server row (e.g. the target isn't in this list) —
  // keep them visible rather than silently dropping the edit.
  for (const [targetEventId, overlay] of overlays) {
    if (!serverIds.has(targetEventId)) {
      merged.push({ summary: overlay.summary, localStatus: overlay.status });
    }
  }

  for (const pending of creates) {
    if (!serverIds.has(pending.summary.id)) {
      merged.push({ summary: pending.summary, localStatus: pending.status });
    }
  }

  return merged.sort((a, b) =>
    order === 'asc'
      ? a.summary.occurredAt.localeCompare(b.summary.occurredAt)
      : b.summary.occurredAt.localeCompare(a.summary.occurredAt),
  );
}
