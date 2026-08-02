import { apiFetch } from './http-client';
import type { DiaperEventSummary } from './diaper-api';
import type { FeedingEventSummary } from './feeding-api';
import type { SleepEventSummary } from './sleep-api';

export type EventType = 'FEEDING' | 'SLEEP' | 'DIAPER';

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
