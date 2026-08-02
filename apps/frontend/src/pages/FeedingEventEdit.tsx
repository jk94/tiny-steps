import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { deleteFeedingEvent, fetchFeedingEvent, updateFeedingEvent } from '../api/feeding-api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { FeedingEventForm } from '../components/FeedingEventForm';
import type { FeedingEventFormOutput } from '../components/FeedingEventForm';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { mapFeedingError } from '../feeding/mapFeedingError';
import { queryClient } from '../lib/query-client';

export function FeedingEventEdit() {
  const { t } = useTranslation();
  const { householdId, childId, eventId } = useParams<{
    householdId: string;
    childId: string;
    eventId: string;
  }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const eventQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId, 'feeding-events', eventId],
    queryFn: () => fetchFeedingEvent(householdId!, childId!, eventId!),
    retry: false,
    enabled: !!householdId && !!childId && !!eventId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteFeedingEvent(householdId!, childId!, eventId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['households', householdId, 'children', childId, 'feeding-events'],
      });
      navigate(`/households/${householdId}/children/${childId}/feeding`, { replace: true });
    },
  });

  if (eventQuery.isLoading) {
    return <LoadingIndicator />;
  }

  if (eventQuery.error || !eventQuery.data) {
    return <ErrorMessage message={t(mapFeedingError(eventQuery.error, 'update'))} />;
  }

  const event = eventQuery.data;

  const handleSubmit = async (output: FeedingEventFormOutput) => {
    // feedingType is immutable after creation (see UpdateFeedingEventDto) —
    // deliberately not forwarded here, the form disables that field in
    // edit mode anyway.
    await updateFeedingEvent(householdId!, childId!, eventId!, {
      occurredAt: output.occurredAt,
      startedAt: output.startedAt,
      endedAt: output.endedAt,
      side: output.side,
      amountMl: output.amountMl,
      note: output.note,
    });
    await queryClient.invalidateQueries({
      queryKey: ['households', householdId, 'children', childId, 'feeding-events'],
    });
    navigate(`/households/${householdId}/children/${childId}/feeding`, { replace: true });
  };

  return (
    <section>
      <Link to={`/households/${householdId}/children/${childId}/feeding`}>
        {t('feeding.edit.backLink')}
      </Link>
      <h1>{t('feeding.edit.title')}</h1>
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

      <button type="button" onClick={() => setIsDeleteDialogOpen(true)}>
        {t('feeding.edit.deleteButton')}
      </button>
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
    </section>
  );
}
