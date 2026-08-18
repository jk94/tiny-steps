import { useTranslation } from 'react-i18next';
import type { EventType } from '../api/event-api';
import { TICK_INTERVAL_MS, formatTimeSince, timeSinceTitle } from '../lib/formatTimeSince';
import { useTick } from '../lib/useTick';
import { Card } from './ui';

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
        <h3 className="text-xs text-muted-foreground">{timeSinceTitle(t, eventType)}</h3>
        <p className="text-sm font-semibold text-foreground">
          {lastEventAt === null
            ? t('stats.timeSince.noEntries')
            : formatTimeSince(t, lastEventAt, now)}
        </p>
      </Card.Body>
    </Card>
  );
}
