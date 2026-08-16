import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { listFeedingEvents } from '../api/feeding-api';
import type { FeedingEventSummary } from '../api/feeding-api';
import { mergeServerAndPendingEvents } from '../offline/mergeServerAndPendingEvents';
import { usePendingLocalEvents } from '../offline/usePendingLocalEvents';
import { LoadingIndicator } from './LoadingIndicator';
import { OfflineStatusBadge } from './OfflineStatusBadge';
import { Card } from './ui';

export interface FeedingEventListProps {
  householdId: string;
  childId: string;
}

function entryLabel(t: TFunction, event: FeedingEventSummary): string {
  if (event.feedingType === 'BREAST') {
    return event.side === 'RIGHT'
      ? t('feeding.list.entryBreastRight')
      : t('feeding.list.entryBreastLeft');
  }
  if (event.feedingType === 'BOTTLE') {
    return t('feeding.list.entryBottle', { amount: event.amountMl ?? 0 });
  }
  return t('feeding.list.entrySolid');
}

/**
 * Recent feeding entries for a child, most recent first (the backend
 * already orders by `occurredAt desc` — see `FeedingService.list`). No
 * pagination at this scale. Each row links to the edit page.
 */
export function FeedingEventList({ householdId, childId }: FeedingEventListProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'feeding-events'],
    queryFn: () => listFeedingEvents(householdId, childId),
    retry: false,
  });
  const pendingQuery = usePendingLocalEvents(householdId, childId, 'FEEDING');

  // Merge in not-yet-confirmed local entries so a just-tapped event shows up
  // immediately. All pending records here are FEEDING-typed (the query filters
  // by type), so narrowing each buffered summary back to FeedingEventSummary is
  // sound.
  const events = mergeServerAndPendingEvents(
    data ?? [],
    (pendingQuery.data ?? []).map((record) => ({
      summary: record.summary as FeedingEventSummary,
      status: record.status,
      operation: record.operation,
      targetEventId: record.targetEventId,
    })),
    'desc',
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {t('feeding.list.title')}
      </h2>
      {isLoading ? (
        <LoadingIndicator />
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('feeding.list.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map(({ summary, localStatus }) => (
            <li key={summary.id}>
              <Card>
                <Link
                  to={`/households/${householdId}/children/${childId}/feeding/${summary.id}/edit`}
                  className="block"
                >
                  <Card.Body className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground">{entryLabel(t, summary)}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {summary.durationSeconds !== null && (
                        <span>
                          {t('feeding.list.durationMinutes', {
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
