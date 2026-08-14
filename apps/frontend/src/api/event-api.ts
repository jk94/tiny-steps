import { ApiError, apiFetch } from './http-client';
import type { DiaperEventSummary } from './diaper-api';
import type { FeedingEventSummary } from './feeding-api';
import type { SleepEventSummary } from './sleep-api';

export type EventType = 'FEEDING' | 'SLEEP' | 'DIAPER';

/** Response-body `code` the backend's `EventConflictException` sets — mirrors
 * `EVENT_CONFLICT_CODE` in `apps/backend/src/event/event-conflict.exception.ts`. */
const EVENT_CONFLICT_CODE = 'EVENT_CONFLICT';

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
