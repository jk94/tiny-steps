import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { listSleepEvents } from '../api/sleep-api';
import type { SleepEventSummary } from '../api/sleep-api';
import { mergeServerAndPendingEvents } from '../offline/mergeServerAndPendingEvents';
import { usePendingLocalEvents } from '../offline/usePendingLocalEvents';
import { LoadingIndicator } from './LoadingIndicator';
import { OfflineStatusBadge } from './OfflineStatusBadge';
import { Card } from './ui';

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
      operation: record.operation,
      targetEventId: record.targetEventId,
    })),
    'desc',
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {t('sleep.list.title')}
      </h2>
      {isLoading ? (
        <LoadingIndicator />
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('sleep.list.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map(({ summary, localStatus }) => (
            <li key={summary.id}>
              <Card>
                <Link
                  to={`/households/${householdId}/children/${childId}/sleep/${summary.id}/edit`}
                  className="block"
                >
                  <Card.Body className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground">{t('sleep.list.entry')}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {summary.durationSeconds !== null && (
                        <span>
                          {t('sleep.list.durationMinutes', {
                            minutes: Math.round(summary.durationSeconds / 60),
                          })}
                        </span>
                      )}
                      <span>{new Date(summary.occurredAt).toLocaleString()}</span>
                      <OfflineStatusBadge status={localStatus} />
                    </span>
                  </Card.Body>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
