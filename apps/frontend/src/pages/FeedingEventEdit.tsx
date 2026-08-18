import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import {
  deleteFeedingEvent,
  fetchFeedingEvent,
  updateFeedingEventOptimistic,
} from '../api/feeding-api';
import type { FeedingEventSummary } from '../api/feeding-api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { FeedingEventForm } from '../components/FeedingEventForm';
import type { FeedingEventFormOutput } from '../components/FeedingEventForm';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Button, Card } from '../components/ui';
import { mapFeedingError } from '../feeding/mapFeedingError';
import { usePendingLocalEvents } from '../offline/usePendingLocalEvents';
import { queryClient } from '../lib/query-client';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

export function FeedingEventEdit() {
  const { t } = useTranslation();
  const { householdId, childId, eventId } = useParams<{
    householdId: string;
    childId: string;
    eventId: string;
  }>();
  useHouseholdRoom(householdId);
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const listQueryKey = ['households', householdId, 'children', childId, 'feeding-events'];
  // Type-independent prefix: also reaches the daily-timeline/stats queries
  // (see event-api.ts), which aren't scoped to a single event type and so
  // aren't covered by listQueryKey alone — mirrors RealtimeProvider's
  // handleEventChanged invalidation for the same reason.
  const eventsQueryKey = ['households', householdId, 'children', childId, 'events'];

  // JC-5: seed the initial form values from what's already available offline —
  // a pending local edit's overlay first, then the cached list row — so the edit
  // page renders without a network round-trip. Falls back to the live fetch when
  // online/uncached; a cold deep-link while fully offline keeps today's error.
  const pendingQuery = usePendingLocalEvents(householdId!, childId!, 'FEEDING');
  const pendingOverlay = pendingQuery.data?.find((record) => record.targetEventId === eventId)
    ?.summary as FeedingEventSummary | undefined;
  const cachedFromList = queryClient
    .getQueryData<FeedingEventSummary[]>(listQueryKey)
    ?.find((event) => event.id === eventId);
  const seededEvent = pendingOverlay ?? cachedFromList;

  const eventQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'feeding-events', eventId],
    queryFn: () => fetchFeedingEvent(householdId!, childId!, eventId!),
    retry: false,
    enabled: !!householdId && !!childId && !!eventId,
    initialData: seededEvent,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteFeedingEvent(householdId!, childId!, eventId!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listQueryKey }),
        queryClient.invalidateQueries({ queryKey: eventsQueryKey }),
      ]);
      navigate(`/households/${householdId}/children/${childId}/feeding`, { replace: true });
    },
  });

  // Only a genuinely uncached, offline cold-load lands here with no data (JC-5's
  // accepted edge case) — otherwise `initialData`/the fetch supplies a row even
  // if a later background refetch errors, so a transient error never blocks edit.
  if (!eventQuery.data) {
    if (eventQuery.isLoading) {
      return <LoadingIndicator />;
    }
    return <ErrorMessage message={t(mapFeedingError(eventQuery.error, 'update'))} />;
  }

  const event = eventQuery.data;

  const handleSubmit = async (output: FeedingEventFormOutput) => {
    // feedingType is immutable after creation (see UpdateFeedingEventDto) —
    // deliberately not forwarded here, the form disables that field in edit
    // mode anyway. `clientTimestamp` is captured now as the Last-Write-Wins
    // baseline (JC-1). The optimistic wrapper buffers the edit and shows it
    // immediately; a conflict surfaces via the app-root banner and an ordinary
    // failure keeps the edited values visible with a badge — either way we
    // return to the list rather than blocking here (JC-2/JC-3).
    try {
      await updateFeedingEventOptimistic(householdId!, childId!, event, {
        occurredAt: output.occurredAt,
        startedAt: output.startedAt,
        endedAt: output.endedAt,
        side: output.side,
        amountMl: output.amountMl,
        note: output.note,
        clientTimestamp: new Date().toISOString(),
      });
    } catch {
      // Buffered locally; surfaced via the list overlay / conflict banner.
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: listQueryKey }),
      queryClient.invalidateQueries({ queryKey: eventsQueryKey }),
    ]);
    navigate(`/households/${householdId}/children/${childId}/feeding`, { replace: true });
  };

  return (
    <section className="mx-auto w-full max-w-sm">
      <Link
        to={`/households/${householdId}/children/${childId}/feeding`}
        className="mb-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        {t('feeding.edit.backLink')}
      </Link>
      <Card>
        <Card.Body className="flex flex-col gap-4">
          <h1 className="text-xl font-bold text-foreground">{t('feeding.edit.title')}</h1>
          <FeedingEventForm
            mode="edit"
            initialValues={{
              feedingType: event.feedingType,
              occurredAt: event.occurredAt,
              startedAt: event.startedAt ?? undefined,
              endedAt: event.endedAt ?? undefined,
              side: event.side ?? undefined,
              amountMl: event.amountMl ?? undefined,
              note: event.note ?? undefined,
            }}
            onSubmit={handleSubmit}
          />

          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            {t('feeding.edit.deleteButton')}
          </Button>
          <ConfirmDialog
            isOpen={isDeleteDialogOpen}
            title={t('feeding.edit.deleteDialog.title')}
            description={t('feeding.edit.deleteDialog.description')}
            confirmLabel={t('feeding.edit.deleteDialog.confirmButton')}
            cancelLabel={t('feeding.edit.deleteDialog.cancelButton')}
            onConfirm={() => deleteMutation.mutate()}
            onCancel={() => setIsDeleteDialogOpen(false)}
            isConfirming={deleteMutation.isPending}
          />
          {deleteMutation.isError && (
            <ErrorMessage message={t(mapFeedingError(deleteMutation.error, 'delete'))} />
          )}
        </Card.Body>
      </Card>
    </section>
  );
}
