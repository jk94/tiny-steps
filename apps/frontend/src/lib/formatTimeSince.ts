import type { TFunction } from 'i18next';
import type { EventType } from '../api/event-api';

/**
 * How often a "time since last event" figure re-renders (via `useTick`) so it
 * keeps advancing on the wall clock alone, without new data arriving. Shared
 * by every component rendering such a figure, so they all tick in lockstep.
 */
export const TICK_INTERVAL_MS = 30_000;

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

/**
 * Renders the elapsed time since `lastEventAt` as localized copy — minutes
 * below an hour ("15 min ago"), whole hours above it ("3h ago"). Clamped at
 * zero so a clock skew (or an event logged "in the future" via backfill)
 * shows "0 min ago" rather than a negative figure.
 */
export function formatTimeSince(t: TFunction, lastEventAt: string, now: number): string {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - new Date(lastEventAt).getTime()) / MS_PER_MINUTE),
  );

  if (elapsedMinutes < MINUTES_PER_HOUR) {
    return t('stats.timeSince.minutesAgo', { minutes: elapsedMinutes });
  }

  return t('stats.timeSince.hoursAgo', { hours: Math.floor(elapsedMinutes / MINUTES_PER_HOUR) });
}

/**
 * The "Last feeding"/"Last sleep"/"Last diaper change" label for a card
 * showing a `formatTimeSince` figure — kept next to the formatter so the two
 * halves of the same copy can't drift apart across the components using them.
 *
 * A `switch` calling `t()` with a literal key directly in each branch, not a
 * `Record<EventType, string>` lookup table — see `TimelineFilter.tsx`'s
 * identical `filterLabel` doc comment for why: `t()`'s literal-key typing
 * (via this repo's `i18next.d.ts`) rejects a widened-to-`string` value,
 * which is what indexing a `Record` (or returning the key itself) produces.
 */
export function timeSinceTitle(t: TFunction, eventType: EventType): string {
  switch (eventType) {
    case 'FEEDING':
      return t('stats.timeSince.feedingTitle');
    case 'SLEEP':
      return t('stats.timeSince.sleepTitle');
    case 'DIAPER':
      return t('stats.timeSince.diaperTitle');
  }
}
