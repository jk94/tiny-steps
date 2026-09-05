import { ApiError, apiFetch } from './http-client';
import type { DiaperEventSummary } from './diaper-api';
import type { FeedingEventSummary } from './feeding-api';
import type { SleepEventSummary } from './sleep-api';

export type EventType = 'FEEDING' | 'SLEEP' | 'DIAPER';

/** Response-body `code` the backend's `EventConflictException` sets — mirrors
 * `EVENT_CONFLICT_CODE` in `apps/backend/src/event/event-conflict.exception.ts`. */
const EVENT_CONFLICT_CODE = 'EVENT_CONFLICT';

/** Response-body `code` the backend's `EventAlreadyStoppedException` sets —
 * mirrors `EVENT_ALREADY_STOPPED_CODE` in the same backend file. */
const EVENT_ALREADY_STOPPED_CODE = 'EVENT_ALREADY_STOPPED';

/** HTTP status the backend's role guard rejects a not-permitted write with. */
const HTTP_STATUS_FORBIDDEN = 403;

/**
 * Whether an error is a Last-Write-Wins conflict (409 with a
 * `{ code: 'EVENT_CONFLICT' }` body) rather than a plain timer conflict or any
 * other failure. Lets the offline engine/sync-queue treat "your edit was
 * overridden" distinctly from a retryable error — see ADR-0011.
 */
export function isEventConflictError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    typeof error.body === 'object' &&
    error.body !== null &&
    (error.body as { code?: unknown }).code === EVENT_CONFLICT_CODE
  );
}

/**
 * Whether an error is a redundant timer-stop (409 with a
 * `{ code: 'EVENT_ALREADY_STOPPED' }` body) — the timer was already stopped by
 * a previous request (a UI race resending the same click, a resent
 * offline-buffered stop, or another device/tab winning first). Distinct from
 * `isEventConflictError`: the desired end state already holds, so the offline
 * engine treats it as an idempotent no-op instead of a failure (see
 * `updateEventOptimistically`/`syncQueue`, ADR-0011 addendum).
 */
export function isEventAlreadyStoppedError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    typeof error.body === 'object' &&
    error.body !== null &&
    (error.body as { code?: unknown }).code === EVENT_ALREADY_STOPPED_CODE
  );
}

/**
 * Whether an error is a 403 from the backend's role guard — the user's
 * household role may not perform this write. Distinct from a retryable failure:
 * resending the identical payload can never succeed, so the offline engine and
 * the sync-queue drop the buffered record (with a dismissible notice) instead
 * of leaving a permanent "not saved" ghost row that no UI can clear.
 *
 * Deliberately matched on the status code alone, not on a body `code`: the
 * `RolesGuard`'s `ForbiddenException` carries no structured code, and every 403
 * the API can return means the same thing here — "this write is not allowed".
 */
export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiError && error.status === HTTP_STATUS_FORBIDDEN;
}

/**
 * Maps an event type to the query-key segment its per-type components use
 * (`['households', hId, 'children', cId, <segment>]`). Shared by the realtime
 * broadcast invalidation (`RealtimeProvider`) and the offline sync-queue
 * (`syncQueue.ts`), which both need to invalidate the same per-type query
 * after a server-confirmed change.
 */
export const EVENT_TYPE_QUERY_KEY_SEGMENT: Record<EventType, string> = {
  FEEDING: 'feeding-events',
  SLEEP: 'sleep-events',
  DIAPER: 'diaper-events',
};

/**
 * Mirrors the backend's `TimelineEventSummary` union (see
 * `apps/backend/src/event/event.service.ts`) — a plain discriminated union
 * of the three existing per-type summaries, discriminated by their shared
 * `type` field. Deliberately not a new shape of its own.
 */
export type TimelineEventSummary = FeedingEventSummary | SleepEventSummary | DiaperEventSummary;

/** Mirrors the backend's `EventStatsSummary` (see `event.service.ts`). Date fields arrive as ISO strings. */
export interface EventStatsSummary {
  sleepHoursToday: number;
  feedingCountToday: number;
  lastEventAt: {
    FEEDING: string | null;
    SLEEP: string | null;
    DIAPER: string | null;
  };
}

function eventsPath(householdId: string, childId: string): string {
  return `/households/${householdId}/children/${childId}/events`;
}

function rangeQuery(from: string, to: string): string {
  return `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export function fetchDailyEvents(
  householdId: string,
  childId: string,
  from: string,
  to: string,
): Promise<TimelineEventSummary[]> {
  return apiFetch<TimelineEventSummary[]>(
    `${eventsPath(householdId, childId)}/daily${rangeQuery(from, to)}`,
  );
}

export function fetchEventStats(
  householdId: string,
  childId: string,
  from: string,
  to: string,
): Promise<EventStatsSummary> {
  return apiFetch<EventStatsSummary>(
    `${eventsPath(householdId, childId)}/stats${rangeQuery(from, to)}`,
  );
}
