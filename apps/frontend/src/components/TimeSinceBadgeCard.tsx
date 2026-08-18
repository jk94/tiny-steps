import { useTranslation } from 'react-i18next';
import type { EventType } from '../api/event-api';
import { TICK_INTERVAL_MS, formatTimeSince, timeSinceTitle } from '../lib/formatTimeSince';
import { useTick } from '../lib/useTick';
import { Badge, type BadgeVariant, Card } from './ui';

/**
 * The `Badge` color each event type's elapsed-time pill uses. The two feeding
 * and diaper sub-type variants are unavailable here on purpose: `lastEventAt`
 * carries only the base event type, so the pill picks one representative
 * sub-type color per family rather than pretending to know the sub-type.
 */
const BADGE_VARIANT_BY_EVENT_TYPE: Record<EventType, BadgeVariant> = {
  FEEDING: 'feeding-bottle',
  SLEEP: 'sleep',
  DIAPER: 'diaper-pee',
};

export interface TimeSinceBadgeCardProps {
  eventType: EventType;
  /** ISO-8601 instant of the most recent event of this type ever, or `null` if there are none. */
  lastEventAt: string | null;
}

/**
 * "Time since last <event type>" as a label/badge row — the child-home
 * dashboard's take on the same data `TimeSinceCard` shows stacked inside the
 * daily timeline's stats strip. Two components rather than one variant-driven
 * one, because only the copy is shared: the layouts, emphasis, and the
 * surrounding page rhythm differ.
 *
 * Recomputes on every `useTick` interval so the figure keeps advancing on the
 * wall clock alone, without any new data arriving.
 */
export function TimeSinceBadgeCard({ eventType, lastEventAt }: TimeSinceBadgeCardProps) {
  const { t } = useTranslation();
  const now = useTick(TICK_INTERVAL_MS);

  return (
    <Card>
      <Card.Body className="flex items-center justify-between gap-3 p-3">
        <h3 className="text-sm font-medium text-foreground">{timeSinceTitle(t, eventType)}</h3>
        {lastEventAt === null ? (
          <span className="text-sm text-muted-foreground">{t('stats.timeSince.noEntries')}</span>
        ) : (
          <Badge variant={BADGE_VARIANT_BY_EVENT_TYPE[eventType]} size="sm">
            {formatTimeSince(t, lastEventAt, now)}
          </Badge>
        )}
      </Card.Body>
    </Card>
  );
}
