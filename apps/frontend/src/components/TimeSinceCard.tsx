import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { EventType } from '../api/event-api';
import { useTick } from '../lib/useTick';
import { Card } from './ui';

const TICK_INTERVAL_MS = 30_000;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

/**
 * A `switch` calling `t()` with a literal key directly in each branch, not a
 * `Record<EventType, string>` lookup table — see `TimelineFilter.tsx`'s
 * identical `filterLabel` doc comment for why: `t()`'s literal-key typing
 * (via this repo's `i18next.d.ts`) rejects a widened-to-`string` value,
 * which is what indexing a `Record` (or returning the key itself) produces.
 */
function titleFor(t: TFunction, eventType: EventType): string {
  switch (eventType) {
    case 'FEEDING':
      return t('stats.timeSince.feedingTitle');
    case 'SLEEP':
      return t('stats.timeSince.sleepTitle');
    case 'DIAPER':
      return t('stats.timeSince.diaperTitle');
  }
}

export interface TimeSinceCardProps {
  eventType: EventType;
  /** ISO-8601 instant of the most recent event of this type ever, or `null` if there are none. */
  lastEventAt: string | null;
}

/**
 * "Time since last <event type>" card — e.g. "Last feeding: vor 3 Stunden".
 * Recomputes on every `useTick` interval so the figure keeps advancing on
 * the wall clock alone, without any new data arriving (the DoD's "aktualisieren
 * sich live" requirement, satisfied here rather than by refetching).
 */
export function TimeSinceCard({ eventType, lastEventAt }: TimeSinceCardProps) {
  const { t } = useTranslation();
  const now = useTick(TICK_INTERVAL_MS);

  return (
    <Card className="flex-1">
      <Card.Body className="flex flex-col gap-1 p-3">
        <h3 className="text-xs text-muted-foreground">{titleFor(t, eventType)}</h3>
        <p className="text-sm font-semibold text-foreground">
          {lastEventAt === null
            ? t('stats.timeSince.noEntries')
            : formatTimeSince(t, lastEventAt, now)}
        </p>
      </Card.Body>
    </Card>
  );
}

function formatTimeSince(
  t: ReturnType<typeof useTranslation>['t'],
  lastEventAt: string,
  now: number,
) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - new Date(lastEventAt).getTime()) / MS_PER_MINUTE),
  );

  if (elapsedMinutes < MINUTES_PER_HOUR) {
    return t('stats.timeSince.minutesAgo', { minutes: elapsedMinutes });
  }

  return t('stats.timeSince.hoursAgo', { hours: Math.floor(elapsedMinutes / MINUTES_PER_HOUR) });
}
