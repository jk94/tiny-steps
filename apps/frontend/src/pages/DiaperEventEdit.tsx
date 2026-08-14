import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import {
  deleteDiaperEvent,
  fetchDiaperEvent,
  updateDiaperEventOptimistic,
} from '../api/diaper-api';
import type { DiaperEventSummary } from '../api/diaper-api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DiaperEventForm } from '../components/DiaperEventForm';
import type { DiaperEventFormOutput } from '../components/DiaperEventForm';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { mapDiaperError } from '../diaper/mapDiaperError';
import { usePendingLocalEvents } from '../offline/usePendingLocalEvents';
import { queryClient } from '../lib/query-client';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

export function DiaperEventEdit() {
  const { t } = useTranslation();
  const { householdId, childId, eventId } = useParams<{
    householdId: string;
    childId: string;
    eventId: string;
  }>();
  useHouseholdRoom(householdId);
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const listQueryKey = ['households', householdId, 'children', childId, 'diaper-events'];

  // JC-5: seed initial form values from a pending local edit's overlay, then the
  // cached list row, so the edit page renders offline (see FeedingEventEdit).
  const pendingQuery = usePendingLocalEvents(householdId!, childId!, 'DIAPER');
  const pendingOverlay = pendingQuery.data?.find((record) => record.targetEventId === eventId)
    ?.summary as DiaperEventSummary | undefined;
  const cachedFromList = queryClient
    .getQueryData<DiaperEventSummary[]>(listQueryKey)
    ?.find((event) => event.id === eventId);
  const seededEvent = pendingOverlay ?? cachedFromList;

  const eventQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'diaper-events', eventId],
    queryFn: () => fetchDiaperEvent(householdId!, childId!, eventId!),
    retry: false,
    enabled: !!householdId && !!childId && !!eventId,
    initialData: seededEvent,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDiaperEvent(householdId!, childId!, eventId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listQueryKey });
      navigate(`/households/${householdId}/children/${childId}/diaper`, { replace: true });
    },
  });

  // See FeedingEventEdit: only an uncached offline cold-load has no data.
  if (!eventQuery.data) {
    if (eventQuery.isLoading) {
      return <LoadingIndicator />;
    }
    return <ErrorMessage message={t(mapDiaperError(eventQuery.error, 'update'))} />;
  }

  const event = eventQuery.data;

  const handleSubmit = async (output: DiaperEventFormOutput) => {
    // Unlike Feeding's edit page, diaperType IS forwarded here — it's editable
    // via PATCH (see UpdateDiaperEventDto). `clientTimestamp` is the
    // Last-Write-Wins baseline (JC-1); the optimistic wrapper buffers + shows
    // the edit immediately, conflicts/failures surface via the banner/list
    // overlay (JC-2/JC-3).
    try {
      await updateDiaperEventOptimistic(householdId!, childId!, event, {
        diaperType: output.diaperType,
        occurredAt: output.occurredAt,
        note: output.note,
        clientTimestamp: new Date().toISOString(),
      });
    } catch {
      // Buffered locally; surfaced via the list overlay / conflict banner.
    }
    await queryClient.invalidateQueries({ queryKey: listQueryKey });
    navigate(`/households/${householdId}/children/${childId}/diaper`, { replace: true });
  };

  return (
    <section>
      <Link to={`/households/${householdId}/children/${childId}/diaper`}>
        {t('diaper.edit.backLink')}
      </Link>
      <h1>{t('diaper.edit.title')}</h1>
      <DiaperEventForm
        mode="edit"
        initialValues={{
          diaperType: event.diaperType,
          occurredAt: event.occurredAt,
          note: event.note ?? undefined,
        }}
        onSubmit={handleSubmit}
      />

      <button type="button" onClick={() => setIsDeleteDialogOpen(true)}>
        {t('diaper.edit.deleteButton')}
      </button>
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title={t('diaper.edit.deleteDialog.title')}
        description={t('diaper.edit.deleteDialog.description')}
        confirmLabel={t('diaper.edit.deleteDialog.confirmButton')}
        cancelLabel={t('diaper.edit.deleteDialog.cancelButton')}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setIsDeleteDialogOpen(false)}
        isConfirming={deleteMutation.isPending}
      />
      {deleteMutation.isError && (
        <ErrorMessage message={t(mapDiaperError(deleteMutation.error, 'delete'))} />
      )}
    </section>
  );
}
