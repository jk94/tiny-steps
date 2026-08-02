import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { fetchDailyEvents } from '../api/event-api';
import type { EventType, TimelineEventSummary } from '../api/event-api';
import { listHouseholdMembers } from '../api/household-api';
import type { HouseholdMemberSummary } from '../api/household-api';
import { LoadingIndicator } from './LoadingIndicator';

export interface TimelineEventListProps {
  householdId: string;
  childId: string;
  from: string;
  to: string;
  dateKey: string;
  /** Purely client-side filter, provided by the sibling `TimelineFilter` via the parent page. */
  enabledTypes: Set<EventType>;
}

function entryLabel(t: TFunction, event: TimelineEventSummary): string {
  switch (event.type) {
    case 'FEEDING':
      if (event.feedingType === 'BREAST') {
        return event.side === 'RIGHT'
          ? t('timeline.list.entryBreastRight')
          : t('timeline.list.entryBreastLeft');
      }
      if (event.feedingType === 'BOTTLE') {
        return t('timeline.list.entryBottle', { amount: event.amountMl ?? 0 });
      }
      return t('timeline.list.entrySolid');
    case 'SLEEP':
      return t('timeline.list.entrySleep');
    case 'DIAPER':
      if (event.diaperType === 'PEE') {
        return t('timeline.list.entryDiaperPee');
      }
      if (event.diaperType === 'STOOL') {
        return t('timeline.list.entryDiaperStool');
      }
      return t('timeline.list.entryDiaperBoth');
  }
}

/**
 * Resolves a logging user's id to their email via the separately-fetched
 * household member list, matched by `userId` — falls back to the raw
 * `userId` (rather than crashing or hiding the row) if the member can't be
 * found, e.g. while the members query is still loading.
 */
function resolveUserLabel(userId: string, members: HouseholdMemberSummary[] | undefined): string {
  const member = members?.find((candidate) => candidate.userId === userId);
  return member?.email ?? userId;
}

/**
 * Chronologically sorted (the backend already orders by `occurredAt asc`,
 * see `EventService.listDaily`), filtered daily timeline for a single child.
 * Fetches the household member list separately (not embedded in the event
 * payload) purely to resolve each row's logging user to an email address.
 */
export function TimelineEventList({
  householdId,
  childId,
  from,
  to,
  dateKey,
  enabledTypes,
}: TimelineEventListProps) {
  const { t } = useTranslation();

  const eventsQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'events', 'daily', dateKey],
    queryFn: () => fetchDailyEvents(householdId, childId, from, to),
    retry: false,
  });
  const membersQuery = useQuery({
    queryKey: ['households', householdId, 'members'],
    queryFn: () => listHouseholdMembers(householdId),
    retry: false,
  });

  if (eventsQuery.isLoading) {
    return <LoadingIndicator />;
  }

  const events = (eventsQuery.data ?? []).filter((event) => enabledTypes.has(event.type));

  if (events.length === 0) {
    return <p>{t('timeline.list.empty')}</p>;
  }

  return (
    <ul>
      {events.map((event) => (
        <li key={event.id}>
          <span>{entryLabel(t, event)}</span>
          <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleTimeString()}</time>
          {event.type !== 'DIAPER' && event.durationSeconds !== null && (
            <span>
              {t('timeline.list.durationMinutes', {
                minutes: Math.round(event.durationSeconds / 60),
              })}
            </span>
          )}
          <span>
            {t('timeline.list.loggedBy', {
              user: resolveUserLabel(event.userId, membersQuery.data),
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
