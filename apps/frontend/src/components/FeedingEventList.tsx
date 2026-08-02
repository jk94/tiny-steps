import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { listFeedingEvents } from '../api/feeding-api';
import type { FeedingEventSummary } from '../api/feeding-api';
import { LoadingIndicator } from './LoadingIndicator';

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

  return (
    <section>
      <h2>{t('feeding.list.title')}</h2>
      {isLoading ? (
        <LoadingIndicator />
      ) : !data || data.length === 0 ? (
        <p>{t('feeding.list.empty')}</p>
      ) : (
        <ul>
          {data.map((event) => (
            <li key={event.id}>
              <Link to={`/households/${householdId}/children/${childId}/feeding/${event.id}/edit`}>
                <span>{entryLabel(t, event)}</span>
                <span>{new Date(event.occurredAt).toLocaleString()}</span>
                {event.durationSeconds !== null && (
                  <span>
                    {t('feeding.list.durationMinutes', {
                      minutes: Math.round(event.durationSeconds / 60),
                    })}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
