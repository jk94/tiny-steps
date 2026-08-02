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
import { LoadingIndicator } from '../components/LoadingIndicator';
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

  if (childQuery.isLoading || activeTimerQuery.isLoading) {
    return <LoadingIndicator />;
  }

  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  const child = childQuery.data;

  return (
    <section>
      <Link to={`/households/${householdId}`}>{t('feeding.home.backLink')}</Link>
      <h1>{t('feeding.home.title', { name: child.name })}</h1>

      {activeTimerQuery.data ? (
        <FeedingTimer householdId={householdId!} childId={childId!} event={activeTimerQuery.data} />
      ) : (
        <FeedingQuickEntry householdId={householdId!} childId={childId!} />
      )}

      <Link to={`/households/${householdId}/children/${childId}/feeding/new`}>
        {t('feeding.home.backfillLink')}
      </Link>

      <FeedingEventList householdId={householdId!} childId={childId!} />
    </section>
  );
}
