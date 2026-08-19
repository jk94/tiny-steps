import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchEventStats } from '../api/event-api';
import { TimeSinceCard } from './TimeSinceCard';
import { Card, Skeleton } from './ui';

export interface DailyStatsSummaryProps {
  householdId: string;
  childId: string;
  from: string;
  to: string;
  dateKey: string;
}

/**
 * Sleep hours / feeding count for the given day, plus a "time since last
 * event" card per event type. The stats query itself is date-scoped (so
 * switching days re-queries, see `dateKey`), but `lastEventAt` within its
 * response is NOT — it's "most recent ever" per `EventService.getStatsSummary`'s
 * own doc comment, so `TimeSinceCard` keeps making sense even when viewing
 * a past day.
 */
export function DailyStatsSummary({
  householdId,
  childId,
  from,
  to,
  dateKey,
}: DailyStatsSummaryProps) {
  const { t } = useTranslation();
  const statsQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'events', 'stats', dateKey],
    queryFn: () => fetchEventStats(householdId, childId, from, to),
    retry: false,
  });

  if (statsQuery.isLoading) {
    return (
      <section className="flex flex-col gap-3" aria-hidden="true">
        <div className="flex gap-3">
          <Card className="flex-1">
            <Card.Body className="flex items-center justify-center p-3">
              <Skeleton shape="text" className="w-2/3" />
            </Card.Body>
          </Card>
          <Card className="flex-1">
            <Card.Body className="flex items-center justify-center p-3">
              <Skeleton shape="text" className="w-2/3" />
            </Card.Body>
          </Card>
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="flex-1">
              <Card.Body className="flex flex-col gap-1 p-3">
                <Skeleton shape="text" className="h-3 w-16" />
                <Skeleton shape="text" className="w-24" />
              </Card.Body>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (!statsQuery.data) {
    // Query failed — this widget is supplementary to the timeline, so it
    // fails silently rather than surfacing a second error UI alongside
    // `TimelineEventList`'s own.
    return null;
  }

  const stats = statsQuery.data;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="sr-only">{t('stats.title')}</h2>
      <div className="flex gap-3">
        <Card className="flex-1">
          <Card.Body className="p-3 text-center">
            <p className="text-sm font-semibold text-foreground">
              {t('stats.sleepHoursToday', { hours: stats.sleepHoursToday })}
            </p>
          </Card.Body>
        </Card>
        <Card className="flex-1">
          <Card.Body className="p-3 text-center">
            <p className="text-sm font-semibold text-foreground">
              {t('stats.feedingCountToday', { count: stats.feedingCountToday })}
            </p>
          </Card.Body>
        </Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <TimeSinceCard eventType="FEEDING" lastEventAt={stats.lastEventAt.FEEDING} />
        <TimeSinceCard eventType="SLEEP" lastEventAt={stats.lastEventAt.SLEEP} />
        <TimeSinceCard eventType="DIAPER" lastEventAt={stats.lastEventAt.DIAPER} />
      </div>
    </section>
  );
}
