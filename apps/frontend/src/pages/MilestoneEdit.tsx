import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import {
  deleteMilestonePhoto,
  fetchMilestone,
  milestonePhotoUrl,
  milestoneQueryKey,
  milestonesQueryKey,
  updateMilestone,
} from '../api/milestone-api';
import type { UpdateMilestoneInput } from '../api/milestone-api';
import { mapChildError } from '../child/mapChildError';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { MilestoneForm } from '../components/milestone/MilestoneForm';
import type { MilestoneFormOutput } from '../components/milestone/MilestoneForm';
import { Button, Card, toast } from '../components/ui';
import { toCalendarDateInputValue } from '../lib/calendarDate';
import { mapMilestoneError } from '../milestone/mapMilestoneError';
import { takePhotoRetryQueue } from '../milestone/photoRetryHandoff';
import { countPendingPhotos, uploadQueuedPhotos } from '../milestone/uploadQueuedPhotos';
import type { QueuedPhoto } from '../milestone/uploadQueuedPhotos';

/**
 * Edit page for a single milestone.
 *
 * Online-only (M-15), exactly like the create page: a failed PATCH keeps the
 * user on the form and raises a toast rather than buffering the edit.
 *
 * This is also where already-uploaded photos are managed (M-9): each can be
 * deleted individually, and further ones can be added up to the per-milestone
 * ceiling. A template entry's title and category are shown read-only by the
 * form — they are owned by the catalog and the server rejects changing them.
 */
export function MilestoneEdit() {
  const { t } = useTranslation();
  const { householdId, childId, milestoneId } = useParams<{
    householdId: string;
    childId: string;
    milestoneId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Seeded once from the create page's handoff, when the user arrived here
  // after a partial photo-upload failure: the still-unuploaded `File` objects
  // travel with them so a retry needs no re-picking. `takePhotoRetryQueue`
  // tolerates StrictMode's double-invoked initializer (see its doc comment). A
  // page reload has no handoff and correctly starts from the stored milestone.
  const [photoResults, setPhotoResults] = useState<QueuedPhoto[] | undefined>(() =>
    milestoneId ? takePhotoRetryQueue(milestoneId) : undefined,
  );
  const [pendingPhotoDeleteId, setPendingPhotoDeleteId] = useState<string | null>(null);

  const milestonePath = `/households/${householdId}/children/${childId}/milestones`;

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const milestoneQuery = useQuery({
    queryKey: milestoneQueryKey(householdId!, childId!, milestoneId!),
    queryFn: () => fetchMilestone(householdId!, childId!, milestoneId!),
    retry: false,
    enabled: !!householdId && !!childId && !!milestoneId,
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateMilestoneInput) =>
      updateMilestone(householdId!, childId!, milestoneId!, input),
    onError: (error) => {
      toast.error(t(mapMilestoneError(error)));
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) =>
      deleteMilestonePhoto(householdId!, childId!, milestoneId!, photoId),
    onSuccess: async () => {
      setPendingPhotoDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: milestonesQueryKey(householdId!, childId!),
      });
    },
    onError: () => {
      setPendingPhotoDeleteId(null);
      toast.error(t('milestone.validation.photoDeleteFailed'));
    },
  });

  if (childQuery.isLoading || milestoneQuery.isLoading) {
    return <LoadingIndicator />;
  }
  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }
  if (milestoneQuery.error || !milestoneQuery.data) {
    return <ErrorMessage message={t(mapMilestoneError(milestoneQuery.error))} />;
  }

  const milestone = milestoneQuery.data;
  const isTemplateEntry = milestone.templateKey !== null;

  const handleSubmit = async (output: MilestoneFormOutput) => {
    await updateMutation.mutateAsync({
      // A template entry's title and category are owned by the catalog, so
      // they are never sent — the server would reject them anyway.
      ...(isTemplateEntry ? {} : { title: output.title, category: output.category }),
      achievedAt: output.achievedAt,
      note: output.note,
    });

    const uploaded = await uploadQueuedPhotos(householdId!, childId!, milestone.id, output.photos);
    await queryClient.invalidateQueries({ queryKey: milestonesQueryKey(householdId!, childId!) });

    const pendingCount = countPendingPhotos(uploaded);
    if (pendingCount > 0) {
      // M-15: the edit itself was saved, but some photos were not — stay here
      // with the failed files listed rather than claiming everything worked.
      setPhotoResults(uploaded);
      toast.error(t('milestone.validation.photoUploadFailed', { count: pendingCount }));
      return;
    }

    await navigate(milestonePath, { replace: true });
  };

  return (
    <section className="mx-auto w-full max-w-sm">
      <Link
        to={milestonePath}
        className="mb-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        {t('milestone.form.backLink')}
      </Link>
      <Card>
        <Card.Body className="flex flex-col gap-4">
          <h1 className="text-xl font-bold text-foreground">{t('milestone.form.editTitle')}</h1>

          {milestone.photos.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                {t('milestone.form.photos.existingLabel')}
              </span>
              <ul className="flex flex-wrap gap-2">
                {milestone.photos.map((photo) => (
                  <li key={photo.id} className="flex flex-col items-center gap-1">
                    <img
                      src={milestonePhotoUrl(householdId!, childId!, milestone.id, photo.id)}
                      alt=""
                      aria-hidden="true"
                      className="h-16 w-16 rounded object-cover"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingPhotoDeleteId(photo.id)}
                    >
                      {t('milestone.form.photos.deleteExisting')}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <MilestoneForm
            mode="edit"
            birthDate={childQuery.data.birthDate.slice(0, 10)}
            existingPhotoCount={milestone.photos.length}
            initialValues={{
              templateKey: milestone.templateKey,
              title: milestone.title,
              category: milestone.category,
              achievedAt: toCalendarDateInputValue(milestone.achievedAt),
              note: milestone.note ?? '',
            }}
            photoResults={photoResults}
            onSubmit={handleSubmit}
          />

          {updateMutation.isError && (
            <ErrorMessage message={t(mapMilestoneError(updateMutation.error))} />
          )}
        </Card.Body>
      </Card>

      <ConfirmDialog
        isOpen={pendingPhotoDeleteId !== null}
        title={t('milestone.gallery.deleteConfirm.title')}
        description={t('milestone.gallery.deleteConfirm.description')}
        confirmLabel={t('milestone.gallery.deleteConfirm.confirmButton')}
        cancelLabel={t('milestone.gallery.deleteConfirm.cancelButton')}
        isConfirming={deletePhotoMutation.isPending}
        onCancel={() => setPendingPhotoDeleteId(null)}
        onConfirm={() => {
          if (pendingPhotoDeleteId) {
            deletePhotoMutation.mutate(pendingPhotoDeleteId);
          }
        }}
      />
    </section>
  );
}
