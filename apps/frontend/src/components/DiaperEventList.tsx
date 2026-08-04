import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { listDiaperEvents } from '../api/diaper-api';
import type { DiaperEventSummary } from '../api/diaper-api';
import { mergeServerAndPendingEvents } from '../offline/mergeServerAndPendingEvents';
import { usePendingLocalEvents } from '../offline/usePendingLocalEvents';
import { LoadingIndicator } from './LoadingIndicator';
import { OfflineStatusBadge } from './OfflineStatusBadge';

export interface DiaperEventListProps {
  householdId: string;
  childId: string;
}

function entryLabel(t: TFunction, event: DiaperEventSummary): string {
  if (event.diaperType === 'PEE') {
    return t('diaper.list.entryPee');
  }
  if (event.diaperType === 'STOOL') {
    return t('diaper.list.entryStool');
  }
  return t('diaper.list.entryBoth');
}

/**
 * Recent diaper entries for a child, most recent first (the backend
 * already orders by `occurredAt desc` — see `DiaperService.list`). No
 * pagination at this scale. Each row links to the edit page. No duration
 * rendering — Diaper is always a point event.
 */
export function DiaperEventList({ householdId, childId }: DiaperEventListProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'diaper-events'],
    queryFn: () => listDiaperEvents(householdId, childId),
    retry: false,
  });
  const pendingQuery = usePendingLocalEvents(householdId, childId, 'DIAPER');

  // Merge in not-yet-confirmed local entries so a just-tapped event shows up
  // immediately. All pending records here are DIAPER-typed (the query filters by
  // type), so narrowing each buffered summary back to DiaperEventSummary is
  // sound.
  const events = mergeServerAndPendingEvents(
    data ?? [],
    (pendingQuery.data ?? []).map((record) => ({
      summary: record.summary as DiaperEventSummary,
      status: record.status,
    })),
    'desc',
  );

  return (
    <section>
      <h2>{t('diaper.list.title')}</h2>
      {isLoading ? (
        <LoadingIndicator />
      ) : events.length === 0 ? (
        <p>{t('diaper.list.empty')}</p>
      ) : (
        <ul>
          {events.map(({ summary, localStatus }) => (
            <li key={summary.id}>
              <Link to={`/households/${householdId}/children/${childId}/diaper/${summary.id}/edit`}>
                <span>{entryLabel(t, summary)}</span>
                <span>{new Date(summary.occurredAt).toLocaleString()}</span>
                <OfflineStatusBadge status={localStatus} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
