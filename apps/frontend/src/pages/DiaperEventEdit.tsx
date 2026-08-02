import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { deleteDiaperEvent, fetchDiaperEvent, updateDiaperEvent } from '../api/diaper-api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DiaperEventForm } from '../components/DiaperEventForm';
import type { DiaperEventFormOutput } from '../components/DiaperEventForm';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { mapDiaperError } from '../diaper/mapDiaperError';
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

  const eventQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'diaper-events', eventId],
    queryFn: () => fetchDiaperEvent(householdId!, childId!, eventId!),
    retry: false,
    enabled: !!householdId && !!childId && !!eventId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDiaperEvent(householdId!, childId!, eventId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['households', householdId, 'children', childId, 'diaper-events'],
      });
      navigate(`/households/${householdId}/children/${childId}/diaper`, { replace: true });
    },
  });

  if (eventQuery.isLoading) {
    return <LoadingIndicator />;
  }

  if (eventQuery.error || !eventQuery.data) {
    return <ErrorMessage message={t(mapDiaperError(eventQuery.error, 'update'))} />;
  }

  const event = eventQuery.data;

  const handleSubmit = async (output: DiaperEventFormOutput) => {
    // Unlike Feeding's edit page, diaperType IS forwarded here — it's
    // editable via PATCH (see UpdateDiaperEventDto's doc comment).
    await updateDiaperEvent(householdId!, childId!, eventId!, {
      diaperType: output.diaperType,
      occurredAt: output.occurredAt,
      note: output.note,
    });
    await queryClient.invalidateQueries({
      queryKey: ['households', householdId, 'children', childId, 'diaper-events'],
    });
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
