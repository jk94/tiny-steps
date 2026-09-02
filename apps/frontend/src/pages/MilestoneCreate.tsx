import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import { createMilestone, milestonesQueryKey } from '../api/milestone-api';
import type { CreateMilestoneInput, MilestoneSummary } from '../api/milestone-api';
import { mapChildError } from '../child/mapChildError';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { MilestoneForm } from '../components/milestone/MilestoneForm';
import type { MilestoneFormOutput } from '../components/milestone/MilestoneForm';
import { Card, toast } from '../components/ui';
import { mapMilestoneError } from '../milestone/mapMilestoneError';
import { stashPhotoRetryQueue } from '../milestone/photoRetryHandoff';
import { countPendingPhotos, uploadQueuedPhotos } from '../milestone/uploadQueuedPhotos';

/**
 * Create page for a single milestone.
 *
 * Online-only (M-15): there is no optimistic write and no offline buffer, so a
 * failed save keeps the user on the form with their input intact and raises a
 * toast. Nothing navigates away and no success state is faked.
 *
 * Photos need a milestone id, so they are uploaded *after* the record exists.
 * That splits failure into two honest cases:
 * - the milestone itself failed — stay put, nothing was created;
 * - the milestone was created but some photos were not — the record exists, so
 *   the user is moved to its edit page (rather than losing it) with the failed
 *   files still listed and an explicit message. Never a silent success.
 */
export function MilestoneCreate() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const milestonePath = `/households/${householdId}/children/${childId}/milestones`;
  // Set when the user arrived from a catalog tile (M-12).
  const presetTemplateKey = searchParams.get('templateKey');

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateMilestoneInput): Promise<MilestoneSummary> =>
      createMilestone(householdId!, childId!, input),
    onError: (error) => {
      toast.error(t(mapMilestoneError(error)));
    },
  });

  if (childQuery.isLoading) {
    return <LoadingIndicator />;
  }
  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  const handleSubmit = async (output: MilestoneFormOutput) => {
    const created = await createMutation.mutateAsync({
      templateKey: output.templateKey ?? undefined,
      title: output.title,
      // Omitted entirely for a template entry: the server derives it from the
      // catalog and rejects a client-sent one.
      category: output.templateKey ? undefined : (output.category ?? undefined),
      achievedAt: output.achievedAt,
      note: output.note ?? undefined,
    });

    const uploaded = await uploadQueuedPhotos(householdId!, childId!, created.id, output.photos);
    await queryClient.invalidateQueries({ queryKey: milestonesQueryKey(householdId!, childId!) });

    const pendingCount = countPendingPhotos(uploaded);
    if (pendingCount === 0) {
      await navigate(milestonePath, { replace: true });
      return;
    }

    // The milestone exists, so going "back" would strand it. Continue into its
    // edit page, handing the still-unuploaded files over so they can be
    // retried there without being re-picked — never a faked success (M-15).
    stashPhotoRetryQueue(created.id, uploaded);
    toast.error(t('milestone.validation.photoUploadFailed', { count: pendingCount }));
    await navigate(`${milestonePath}/${created.id}/edit`, { replace: true });
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
          <h1 className="text-xl font-bold text-foreground">{t('milestone.form.createTitle')}</h1>
          <MilestoneForm
            mode="create"
            birthDate={childQuery.data.birthDate.slice(0, 10)}
            templateKey={presetTemplateKey}
            onSubmit={handleSubmit}
          />
          {createMutation.isError && (
            <ErrorMessage message={t(mapMilestoneError(createMutation.error))} />
          )}
        </Card.Body>
      </Card>
    </section>
  );
}
