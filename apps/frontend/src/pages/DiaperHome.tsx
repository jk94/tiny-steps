import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import { mapChildError } from '../child/mapChildError';
import { DiaperEventList } from '../components/DiaperEventList';
import { DiaperQuickEntry } from '../components/DiaperQuickEntry';
import { ErrorMessage } from '../components/ErrorMessage';
import { Skeleton } from '../components/ui';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

/**
 * Per-child quick-entry screen — the simplest of the three Home pages: no
 * active-timer query and no timer/quick-entry branch at all, since Diaper
 * is never timer-based (see `DiaperQuickEntry`'s doc comment).
 * `<DiaperQuickEntry>` is always rendered. Mirrors `FeedingHome`/
 * `SleepHome` minus the timer plumbing.
 */
export function DiaperHome() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  useHouseholdRoom(householdId);

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  if (childQuery.isLoading) {
    return (
      <section className="flex flex-col gap-4" aria-hidden="true">
        <div className="flex flex-col gap-1">
          <Skeleton shape="text" className="h-4 w-24" />
          <Skeleton shape="text" className="h-7 w-48" />
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex flex-col gap-3 lg:w-home-sidebar lg:flex-none">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
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

  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link
          to={`/households/${householdId}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('diaper.home.backLink')}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-foreground">
          {t('diaper.home.title', { name: child.name })}
        </h1>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-3 lg:w-home-sidebar lg:flex-none">
          <DiaperQuickEntry householdId={householdId!} childId={childId!} />

          <Link
            to={`/households/${householdId}/children/${childId}/diaper/new`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t('diaper.home.backfillLink')}
          </Link>
        </div>

        <div className="flex-1">
          <DiaperEventList householdId={householdId!} childId={childId!} />
        </div>
      </div>
    </section>
  );
}
