import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import { mapChildError } from '../child/mapChildError';
import { DiaperEventList } from '../components/DiaperEventList';
import { DiaperQuickEntry } from '../components/DiaperQuickEntry';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';

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
    <section>
      <Link to={`/households/${householdId}`}>{t('diaper.home.backLink')}</Link>
      <h1>{t('diaper.home.title', { name: child.name })}</h1>

      <DiaperQuickEntry householdId={householdId!} childId={childId!} />

      <Link to={`/households/${householdId}/children/${childId}/diaper/new`}>
        {t('diaper.home.backfillLink')}
      </Link>

      <DiaperEventList householdId={householdId!} childId={childId!} />
    </section>
  );
}
