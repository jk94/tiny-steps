import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import { fetchActiveFeedingTimer } from '../api/feeding-api';
import { mapChildError } from '../child/mapChildError';
import { ErrorMessage } from '../components/ErrorMessage';
import { FeedingEventList } from '../components/FeedingEventList';
import { FeedingQuickEntry } from '../components/FeedingQuickEntry';
import { FeedingTimer } from '../components/FeedingTimer';
import { OfflineStatusBadge } from '../components/OfflineStatusBadge';
import { Skeleton } from '../components/ui';
import { usePendingLocalEvents } from '../offline/usePendingLocalEvents';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

/**
 * Per-child quick-entry/timer start screen. On mount, fetches the active
 * BREAST timer (if any) from the server. If one is running, `<FeedingTimer>`
 * is rendered instead of `<FeedingQuickEntry>` — this is how "timer
 * survives app restart" is satisfied without any local persistence layer:
 * the backend's `endedAt: null` row IS the running-timer state, a reload
 * just re-fetches it.
 */
export function FeedingHome() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  useHouseholdRoom(householdId);

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const activeTimerQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'feeding-events', 'active-timer'],
    queryFn: () => fetchActiveFeedingTimer(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const pendingQuery = usePendingLocalEvents(householdId!, childId!, 'FEEDING');

  if (childQuery.isLoading || activeTimerQuery.isLoading) {
    return (
      <section className="flex flex-col gap-4" aria-hidden="true">
        <div className="flex flex-col gap-1">
          <Skeleton shape="text" className="h-4 w-24" />
          <Skeleton shape="text" className="h-7 w-48" />
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="grid grid-cols-2 gap-2 lg:w-home-sidebar lg:flex-none">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </section>
    );
  }

  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  const child = childQuery.data;

  // A locally-buffered timer-stop that hasn't synced yet: the server still
  // reports the timer as running, but the user already stopped it, so show the
  // stopped/optimistic state rather than the ticking timer (JC-2, step 20).
  const activeTimer = activeTimerQuery.data;
  const pendingStop = activeTimer
    ? pendingQuery.data?.find(
        (record) => record.operation === 'stop' && record.targetEventId === activeTimer.id,
      )
    : undefined;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link
          to={`/households/${householdId}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('feeding.home.backLink')}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-foreground">
          {t('feeding.home.title', { name: child.name })}
        </h1>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-3 lg:w-home-sidebar lg:flex-none">
          {activeTimer && pendingStop ? (
            <section>
              <p className="text-sm text-muted-foreground">
                {t('feeding.timer.stopped')} <OfflineStatusBadge status={pendingStop.status} />
              </p>
            </section>
          ) : activeTimer ? (
            <FeedingTimer householdId={householdId!} childId={childId!} event={activeTimer} />
          ) : (
            <FeedingQuickEntry householdId={householdId!} childId={childId!} />
          )}

          <Link
            to={`/households/${householdId}/children/${childId}/feeding/new`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t('feeding.home.backfillLink')}
          </Link>
        </div>

        <div className="flex-1">
          <FeedingEventList householdId={householdId!} childId={childId!} />
        </div>
      </div>
    </section>
  );
}
