import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import { createGrowthMeasurement, growthQueryKey } from '../api/growth-api';
import type { CreateGrowthMeasurementInput } from '../api/growth-api';
import { mapChildError } from '../child/mapChildError';
import { ErrorMessage } from '../components/ErrorMessage';
import { GrowthMeasurementForm } from '../components/growth/GrowthMeasurementForm';
import type { GrowthMeasurementFormOutput } from '../components/growth/GrowthMeasurementForm';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Card, toast } from '../components/ui';

/**
 * Create page for a single growth measurement.
 *
 * Online-only (W-16): there is no optimistic write and no offline buffer, so a
 * failed save keeps the user on the form with their input intact and raises a
 * toast. Nothing navigates away and no success state is faked.
 */
export function GrowthMeasurementCreate() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const growthPath = `/households/${householdId}/children/${childId}/growth`;

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateGrowthMeasurementInput) =>
      createGrowthMeasurement(householdId!, childId!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: growthQueryKey(householdId!, childId!) });
      navigate(growthPath, { replace: true });
    },
    onError: () => {
      toast.error(t('growth.validation.saveFailed'));
    },
  });

  if (childQuery.isLoading) {
    return <LoadingIndicator />;
  }
  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  const handleSubmit = async (output: GrowthMeasurementFormOutput) => {
    // Create mode never produces `null` (see `GrowthMeasurementForm`), so the
    // nullable output type is narrowed back to the create input's shape here.
    await createMutation.mutateAsync({
      measuredAt: output.measuredAt,
      weightGrams: output.weightGrams ?? undefined,
      lengthMillimeters: output.lengthMillimeters ?? undefined,
      headCircumferenceMillimeters: output.headCircumferenceMillimeters ?? undefined,
      lengthMeasurementPosition: output.lengthMeasurementPosition ?? undefined,
      note: output.note ?? undefined,
    });
  };

  return (
    <section className="mx-auto w-full max-w-sm">
      <Link
        to={growthPath}
        className="mb-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        {t('growth.form.backLink')}
      </Link>
      <Card>
        <Card.Body className="flex flex-col gap-4">
          <h1 className="text-xl font-bold text-foreground">{t('growth.form.titleCreate')}</h1>
          <GrowthMeasurementForm
            mode="create"
            birthDate={childQuery.data.birthDate.slice(0, 10)}
            onSubmit={handleSubmit}
          />
          {createMutation.isError && <ErrorMessage message={t('growth.validation.saveFailed')} />}
        </Card.Body>
      </Card>
    </section>
  );
}
