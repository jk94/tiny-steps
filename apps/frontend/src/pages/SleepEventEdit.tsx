import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { deleteSleepEvent, fetchSleepEvent, updateSleepEvent } from '../api/sleep-api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { SleepEventForm } from '../components/SleepEventForm';
import type { SleepEventFormOutput } from '../components/SleepEventForm';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { mapSleepError } from '../sleep/mapSleepError';
import { queryClient } from '../lib/query-client';

export function SleepEventEdit() {
  const { t } = useTranslation();
  const { householdId, childId, eventId } = useParams<{
    householdId: string;
    childId: string;
    eventId: string;
  }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const eventQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'sleep-events', eventId],
    queryFn: () => fetchSleepEvent(householdId!, childId!, eventId!),
    retry: false,
    enabled: !!householdId && !!childId && !!eventId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSleepEvent(householdId!, childId!, eventId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['households', householdId, 'children', childId, 'sleep-events'],
      });
      navigate(`/households/${householdId}/children/${childId}/sleep`, { replace: true });
    },
  });

  if (eventQuery.isLoading) {
    return <LoadingIndicator />;
  }

  if (eventQuery.error || !eventQuery.data) {
    return <ErrorMessage message={t(mapSleepError(eventQuery.error, 'update'))} />;
  }

  const event = eventQuery.data;

  const handleSubmit = async (output: SleepEventFormOutput) => {
    // No immutability concern here, unlike Feeding's feedingType — Sleep
    // has no discriminant field, so every field is forwarded as-is.
    await updateSleepEvent(householdId!, childId!, eventId!, {
      occurredAt: output.occurredAt,
      startedAt: output.startedAt,
      endedAt: output.endedAt,
    });
    await queryClient.invalidateQueries({
      queryKey: ['households', householdId, 'children', childId, 'sleep-events'],
    });
    navigate(`/households/${householdId}/children/${childId}/sleep`, { replace: true });
  };

  return (
    <section>
      <Link to={`/households/${householdId}/children/${childId}/sleep`}>
        {t('sleep.edit.backLink')}
      </Link>
      <h1>{t('sleep.edit.title')}</h1>
      <SleepEventForm
        mode="edit"
        initialValues={{
          occurredAt: event.occurredAt,
          endedAt: event.endedAt ?? undefined,
        }}
        onSubmit={handleSubmit}
      />

      <button type="button" onClick={() => setIsDeleteDialogOpen(true)}>
        {t('sleep.edit.deleteButton')}
      </button>
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
    </section>
  );
}
