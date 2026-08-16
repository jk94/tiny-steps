import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import type { EventType } from '../api/event-api';
import { mapChildError } from '../child/mapChildError';
import { DailyStatsSummary } from '../components/DailyStatsSummary';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { TimelineEventList } from '../components/TimelineEventList';
import { TimelineFilter } from '../components/TimelineFilter';
import { getLocalDayBoundaries } from '../lib/dayBoundaries';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

const ALL_EVENT_TYPES: EventType[] = ['FEEDING', 'SLEEP', 'DIAPER'];

/**
 * Daily timeline + stats page for a single child — composes `TimelineFilter`
 * (client-side type filter), `TimelineEventList` (the chronological view),
 * and `DailyStatsSummary` (sleep hours/feeding count/time-since cards).
 * `useHouseholdRoom` is called here (not in the child components) exactly
 * like the existing per-type Home pages, so the socket room join/leave
 * behavior matches the rest of the app.
 *
 * `dayBoundaries` is computed once via a lazy `useState` initializer, not
 * recomputed on every render — this page always shows "today" for the
 * lifetime of a single mount; a future "pick a different day" control would
 * need to update this deliberately rather than have it silently drift.
 */
export function DailyTimeline() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  useHouseholdRoom(householdId);

  const [dayBoundaries] = useState(() => getLocalDayBoundaries());
  const [enabledTypes, setEnabledTypes] = useState<Set<EventType>>(() => new Set(ALL_EVENT_TYPES));

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  if (childQuery.isLoading) {
    return <LoadingIndicator />;
  }

  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  const child = childQuery.data;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <Link
          to={`/households/${householdId}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('timeline.backLink')}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-foreground">
          {t('timeline.title', { name: child.name })}
        </h1>
      </div>

      <DailyStatsSummary
        householdId={householdId!}
        childId={childId!}
        from={dayBoundaries.from}
        to={dayBoundaries.to}
        dateKey={dayBoundaries.dateKey}
      />

      <TimelineFilter enabledTypes={enabledTypes} onChange={setEnabledTypes} />

      <TimelineEventList
        householdId={householdId!}
        childId={childId!}
        from={dayBoundaries.from}
        to={dayBoundaries.to}
        dateKey={dayBoundaries.dateKey}
        enabledTypes={enabledTypes}
      />
    </section>
  );
}
