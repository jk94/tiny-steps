import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import { fetchActiveSleepTimer } from '../api/sleep-api';
import { mapChildError } from '../child/mapChildError';
import { ErrorMessage } from '../components/ErrorMessage';
import { SleepEventList } from '../components/SleepEventList';
import { SleepQuickEntry } from '../components/SleepQuickEntry';
import { SleepTimer } from '../components/SleepTimer';
import { OfflineStatusBadge } from '../components/OfflineStatusBadge';
import { Skeleton } from '../components/ui';
import { usePendingLocalEvents } from '../offline/usePendingLocalEvents';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

/**
 * Per-child quick-entry/timer start screen. On mount, fetches the active
 * sleep timer (if any) from the server. If one is running, `<SleepTimer>`
 * is rendered instead of `<SleepQuickEntry>` — this is how "timer survives
 * app restart" is satisfied without any local persistence layer: the
 * backend's `endedAt: null` row IS the running-timer state, a reload just
 * re-fetches it. Mirrors `FeedingHome`.
 */
export function SleepHome() {
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
    queryKey: ['households', householdId, 'children', childId, 'sleep-events', 'active-timer'],
    queryFn: () => fetchActiveSleepTimer(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const pendingQuery = usePendingLocalEvents(householdId!, childId!, 'SLEEP');

  if (childQuery.isLoading || activeTimerQuery.isLoading) {
    return (
      <section className="flex flex-col gap-4" aria-hidden="true">
        <div className="flex flex-col gap-1">
          <Skeleton shape="text" className="h-4 w-24" />
          <Skeleton shape="text" className="h-7 w-48" />
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex flex-col gap-3 lg:w-home-sidebar lg:flex-none">
            <Skeleton className="h-14 w-full" />
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

  // A locally-buffered timer-stop not yet synced: show the stopped/optimistic
  // state rather than the ticking timer (JC-2, step 20) — see FeedingHome.
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
          {t('sleep.home.backLink')}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-foreground">
          {t('sleep.home.title', { name: child.name })}
        </h1>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-3 lg:w-home-sidebar lg:flex-none">
          {activeTimer && pendingStop ? (
            <section>
              <p className="text-sm text-muted-foreground">
                {t('sleep.timer.stopped')} <OfflineStatusBadge status={pendingStop.status} />
              </p>
            </section>
          ) : activeTimer ? (
            <SleepTimer householdId={householdId!} childId={childId!} event={activeTimer} />
          ) : (
            <SleepQuickEntry householdId={householdId!} childId={childId!} />
          )}

          <Link
            to={`/households/${householdId}/children/${childId}/sleep/new`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t('sleep.home.backfillLink')}
          </Link>
        </div>

        <div className="flex-1">
          <SleepEventList householdId={householdId!} childId={childId!} />
        </div>
      </div>
    </section>
  );
}
