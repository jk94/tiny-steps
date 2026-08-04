import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { listSleepEvents } from '../api/sleep-api';
import type { SleepEventSummary } from '../api/sleep-api';
import { mergeServerAndPendingEvents } from '../offline/mergeServerAndPendingEvents';
import { usePendingLocalEvents } from '../offline/usePendingLocalEvents';
import { LoadingIndicator } from './LoadingIndicator';
import { OfflineStatusBadge } from './OfflineStatusBadge';

export interface SleepEventListProps {
  householdId: string;
  childId: string;
}

/**
 * Recent sleep entries for a child, most recent first (the backend already
 * orders by `occurredAt desc` — see `SleepService.list`). No pagination at
 * this scale, no type-branching (unlike `FeedingEventList`, Sleep is a
 * single generic entry kind). Each row links to the edit page.
 */
export function SleepEventList({ householdId, childId }: SleepEventListProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'sleep-events'],
    queryFn: () => listSleepEvents(householdId, childId),
    retry: false,
  });
  const pendingQuery = usePendingLocalEvents(householdId, childId, 'SLEEP');

  // Merge in not-yet-confirmed local entries so a just-tapped event shows up
  // immediately. All pending records here are SLEEP-typed (the query filters by
  // type), so narrowing each buffered summary back to SleepEventSummary is
  // sound.
  const events = mergeServerAndPendingEvents(
    data ?? [],
    (pendingQuery.data ?? []).map((record) => ({
      summary: record.summary as SleepEventSummary,
      status: record.status,
    })),
    'desc',
  );

  return (
    <section>
      <h2>{t('sleep.list.title')}</h2>
      {isLoading ? (
        <LoadingIndicator />
      ) : events.length === 0 ? (
        <p>{t('sleep.list.empty')}</p>
      ) : (
        <ul>
          {events.map(({ summary, localStatus }) => (
            <li key={summary.id}>
              <Link to={`/households/${householdId}/children/${childId}/sleep/${summary.id}/edit`}>
                <span>{t('sleep.list.entry')}</span>
                <span>{new Date(summary.occurredAt).toLocaleString()}</span>
                {summary.durationSeconds !== null && (
                  <span>
                    {t('sleep.list.durationMinutes', {
                      minutes: Math.round(summary.durationSeconds / 60),
                    })}
                  </span>
                )}
                <OfflineStatusBadge status={localStatus} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
