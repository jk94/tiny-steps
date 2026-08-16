import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { deleteSleepEvent, fetchSleepEvent, updateSleepEventOptimistic } from '../api/sleep-api';
import type { SleepEventSummary } from '../api/sleep-api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { SleepEventForm } from '../components/SleepEventForm';
import type { SleepEventFormOutput } from '../components/SleepEventForm';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Button, Card } from '../components/ui';
import { mapSleepError } from '../sleep/mapSleepError';
import { usePendingLocalEvents } from '../offline/usePendingLocalEvents';
import { queryClient } from '../lib/query-client';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

export function SleepEventEdit() {
  const { t } = useTranslation();
  const { householdId, childId, eventId } = useParams<{
    householdId: string;
    childId: string;
    eventId: string;
  }>();
  useHouseholdRoom(householdId);
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const listQueryKey = ['households', householdId, 'children', childId, 'sleep-events'];

  // JC-5: seed initial form values from a pending local edit's overlay, then the
  // cached list row, so the edit page renders offline (see FeedingEventEdit).
  const pendingQuery = usePendingLocalEvents(householdId!, childId!, 'SLEEP');
  const pendingOverlay = pendingQuery.data?.find((record) => record.targetEventId === eventId)
    ?.summary as SleepEventSummary | undefined;
  const cachedFromList = queryClient
    .getQueryData<SleepEventSummary[]>(listQueryKey)
    ?.find((event) => event.id === eventId);
  const seededEvent = pendingOverlay ?? cachedFromList;

  const eventQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'sleep-events', eventId],
    queryFn: () => fetchSleepEvent(householdId!, childId!, eventId!),
    retry: false,
    enabled: !!householdId && !!childId && !!eventId,
    initialData: seededEvent,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSleepEvent(householdId!, childId!, eventId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listQueryKey });
      navigate(`/households/${householdId}/children/${childId}/sleep`, { replace: true });
    },
  });

  // See FeedingEventEdit: only an uncached offline cold-load has no data.
  if (!eventQuery.data) {
    if (eventQuery.isLoading) {
      return <LoadingIndicator />;
    }
    return <ErrorMessage message={t(mapSleepError(eventQuery.error, 'update'))} />;
  }

  const event = eventQuery.data;

  const handleSubmit = async (output: SleepEventFormOutput) => {
    // No immutability concern here, unlike Feeding's feedingType — Sleep has no
    // discriminant field. `clientTimestamp` is the Last-Write-Wins baseline
    // (JC-1); the optimistic wrapper buffers + shows the edit immediately, and
    // conflicts/failures surface via the banner/list overlay (JC-2/JC-3).
    try {
      await updateSleepEventOptimistic(householdId!, childId!, event, {
        occurredAt: output.occurredAt,
        startedAt: output.startedAt,
        endedAt: output.endedAt,
        clientTimestamp: new Date().toISOString(),
      });
    } catch {
      // Buffered locally; surfaced via the list overlay / conflict banner.
    }
    await queryClient.invalidateQueries({ queryKey: listQueryKey });
    navigate(`/households/${householdId}/children/${childId}/sleep`, { replace: true });
  };

  return (
    <section className="mx-auto w-full max-w-sm">
      <Link
        to={`/households/${householdId}/children/${childId}/sleep`}
        className="mb-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        {t('sleep.edit.backLink')}
      </Link>
      <Card>
        <Card.Body className="flex flex-col gap-4">
          <h1 className="text-xl font-bold text-foreground">{t('sleep.edit.title')}</h1>
          <SleepEventForm
            mode="edit"
            initialValues={{
              occurredAt: event.occurredAt,
              endedAt: event.endedAt ?? undefined,
            }}
            onSubmit={handleSubmit}
          />

          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            {t('sleep.edit.deleteButton')}
          </Button>
          <ConfirmDialog
            isOpen={isDeleteDialogOpen}
            title={t('sleep.edit.deleteDialog.title')}
            description={t('sleep.edit.deleteDialog.description')}
            confirmLabel={t('sleep.edit.deleteDialog.confirmButton')}
            cancelLabel={t('sleep.edit.deleteDialog.cancelButton')}
            onConfirm={() => deleteMutation.mutate()}
            onCancel={() => setIsDeleteDialogOpen(false)}
            isConfirming={deleteMutation.isPending}
          />
          {deleteMutation.isError && (
            <ErrorMessage message={t(mapSleepError(deleteMutation.error, 'delete'))} />
          )}
        </Card.Body>
      </Card>
    </section>
  );
}
