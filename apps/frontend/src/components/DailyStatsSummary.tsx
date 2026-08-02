import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchEventStats } from '../api/event-api';
import { LoadingIndicator } from './LoadingIndicator';
import { TimeSinceCard } from './TimeSinceCard';

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
    return <LoadingIndicator />;
  }

  if (!statsQuery.data) {
    // Query failed — this widget is supplementary to the timeline, so it
    // fails silently rather than surfacing a second error UI alongside
    // `TimelineEventList`'s own.
    return null;
  }

  const stats = statsQuery.data;

  return (
    <section>
      <h2>{t('stats.title')}</h2>
      <p>{t('stats.sleepHoursToday', { hours: stats.sleepHoursToday })}</p>
      <p>{t('stats.feedingCountToday', { count: stats.feedingCountToday })}</p>
      <TimeSinceCard eventType="FEEDING" lastEventAt={stats.lastEventAt.FEEDING} />
      <TimeSinceCard eventType="SLEEP" lastEventAt={stats.lastEventAt.SLEEP} />
      <TimeSinceCard eventType="DIAPER" lastEventAt={stats.lastEventAt.DIAPER} />
    </section>
  );
}
