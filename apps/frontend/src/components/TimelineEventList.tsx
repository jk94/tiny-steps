import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { fetchDailyEvents } from '../api/event-api';
import type { EventType, TimelineEventSummary } from '../api/event-api';
import { listHouseholdMembers } from '../api/household-api';
import type { HouseholdMemberSummary } from '../api/household-api';
import { mergeServerAndPendingEvents } from '../offline/mergeServerAndPendingEvents';
import { usePendingLocalEvents } from '../offline/usePendingLocalEvents';
import { LoadingIndicator } from './LoadingIndicator';
import { OfflineStatusBadge } from './OfflineStatusBadge';
import { Badge, Card, type BadgeVariant } from './ui';

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

function badgeVariantFor(event: TimelineEventSummary): BadgeVariant {
  switch (event.type) {
    case 'FEEDING':
      if (event.feedingType === 'BREAST') {
        return 'feeding-breast';
      }
      if (event.feedingType === 'BOTTLE') {
        return 'feeding-bottle';
      }
      return 'feeding-solid';
    case 'SLEEP':
      return 'sleep';
    case 'DIAPER':
      if (event.diaperType === 'PEE') {
        return 'diaper-pee';
      }
      if (event.diaperType === 'STOOL') {
        return 'diaper-stool';
      }
      return 'diaper-both';
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
  // No type filter here — the timeline shows all three kinds; the enabled-types
  // filter is applied to the merged result below. The pending records DO need
  // the same `[from, to)` day-window filtering as the server query, though: a
  // backfill create can carry an arbitrary past `occurredAt`, so a pending (or
  // failed) backfill-for-another-day must not leak onto this day's timeline.
  const pendingQuery = usePendingLocalEvents(householdId, childId);

  if (eventsQuery.isLoading) {
    return <LoadingIndicator />;
  }

  const pendingForThisDay = (pendingQuery.data ?? [])
    .filter((record) => record.summary.occurredAt >= from && record.summary.occurredAt < to)
    .map((record) => ({
      summary: record.summary,
      status: record.status,
      operation: record.operation,
      targetEventId: record.targetEventId,
    }));

  const events = mergeServerAndPendingEvents(
    eventsQuery.data ?? [],
    pendingForThisDay,
    'asc',
  ).filter(({ summary }) => enabledTypes.has(summary.type));

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('timeline.list.empty')}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {events.map(({ summary, localStatus }) => (
        <li key={summary.id}>
          <Card>
            <Card.Body className="flex items-center gap-3">
              <Badge variant={badgeVariantFor(summary)} size="sm">
                {entryLabel(t, summary)}
              </Badge>
              <div className="flex flex-1 flex-col">
                <time dateTime={summary.occurredAt} className="text-sm text-foreground">
                  {new Date(summary.occurredAt).toLocaleTimeString()}
                </time>
                <span className="flex gap-1 text-xs text-muted-foreground">
                  {summary.type !== 'DIAPER' && summary.durationSeconds !== null && (
                    <span>
                      {t('timeline.list.durationMinutes', {
                        minutes: Math.round(summary.durationSeconds / 60),
                      })}
                    </span>
                  )}
                  <span>
                    {t('timeline.list.loggedBy', {
                      user: resolveUserLabel(summary.userId, membersQuery.data),
                    })}
                  </span>
                </span>
              </div>
              <OfflineStatusBadge status={localStatus} />
            </Card.Body>
          </Card>
        </li>
      ))}
    </ul>
  );
}
