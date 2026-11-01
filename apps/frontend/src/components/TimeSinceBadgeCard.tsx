import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { EventType } from '../api/event-api';
import { CHILD_AREAS, type ChildAreaKey } from '../lib/childAreas';
import { cn } from '../lib/cn';
import { TICK_INTERVAL_MS, formatTimeSince, timeSinceTitle } from '../lib/formatTimeSince';
import { useTick } from '../lib/useTick';
import { Badge, type BadgeVariant } from './ui';

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

const AREA_BY_EVENT_TYPE: Record<EventType, ChildAreaKey> = {
  FEEDING: 'feeding',
  SLEEP: 'sleep',
  DIAPER: 'diaper',
};

export interface TimeSinceBadgeCardProps {
  eventType: EventType;
  /** ISO-8601 instant of the most recent event of this type ever, or `null` if there are none. */
  lastEventAt: string | null;
  /** When set, the whole tile links there (the event type's own screen). */
  to?: string;
}

/**
 * "Time since last <event type>" as an illustrated, area-tinted tile — the
 * child-home dashboard's take on the same data `TimeSinceCard` shows stacked
 * inside the daily timeline's stats strip. Two components rather than one
 * variant-driven one, because only the copy is shared: the layouts, emphasis,
 * and the surrounding page rhythm differ.
 *
 * Recomputes on every `useTick` interval so the figure keeps advancing on the
 * wall clock alone, without any new data arriving.
 */
export function TimeSinceBadgeCard({ eventType, lastEventAt, to }: TimeSinceBadgeCardProps) {
  const { t } = useTranslation();
  const now = useTick(TICK_INTERVAL_MS);
  const area = CHILD_AREAS[AREA_BY_EVENT_TYPE[eventType]];

  const content = (
    <>
      <area.Illustration className="h-12 w-12 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
      <h3 className="text-xs leading-tight font-bold text-foreground">
        {timeSinceTitle(t, eventType)}
      </h3>
      {lastEventAt === null ? (
        <span className="text-xs text-muted-foreground">{t('stats.timeSince.noEntries')}</span>
      ) : (
        <Badge variant={BADGE_VARIANT_BY_EVENT_TYPE[eventType]} size="sm">
          {formatTimeSince(t, lastEventAt, now)}
        </Badge>
      )}
    </>
  );

  const className = cn(
    'group flex h-full flex-col items-center gap-1.5 rounded-lg p-3 text-center',
    area.tint,
  );

  return to ? (
    <Link
      to={to}
      className={cn(
        className,
        'transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95',
      )}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
