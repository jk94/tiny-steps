import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import { fetchGrowthMeasurement, growthQueryKey, updateGrowthMeasurement } from '../api/growth-api';
import type { UpdateGrowthMeasurementInput } from '../api/growth-api';
import { mapChildError } from '../child/mapChildError';
import { ErrorMessage } from '../components/ErrorMessage';
import { GrowthMeasurementForm } from '../components/growth/GrowthMeasurementForm';
import type { GrowthMeasurementFormOutput } from '../components/growth/GrowthMeasurementForm';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Card, toast } from '../components/ui';
import { toCalendarDateInputValue } from '../lib/calendarDate';
import { gramsToKilograms, millimetresToCentimetres } from '../lib/growthUnits';

/** Renders a stored base-unit value as the form's display-unit string. */
function toInputValue(value: number | null, convert: (input: number) => number): string {
  return value === null ? '' : String(convert(value));
}

/**
 * Edit page for a single growth measurement (W-8).
 *
 * Online-only (W-16), exactly like the create page: a failed PATCH keeps the
 * user on the form and raises a toast rather than buffering the edit.
 */
export function GrowthMeasurementEdit() {
  const { t } = useTranslation();
  const { householdId, childId, measurementId } = useParams<{
    householdId: string;
    childId: string;
    measurementId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const growthPath = `/households/${householdId}/children/${childId}/growth`;

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const measurementQuery = useQuery({
    queryKey: [...growthQueryKey(householdId!, childId!), measurementId],
    queryFn: () => fetchGrowthMeasurement(householdId!, childId!, measurementId!),
    retry: false,
    enabled: !!householdId && !!childId && !!measurementId,
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateGrowthMeasurementInput) =>
      updateGrowthMeasurement(householdId!, childId!, measurementId!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: growthQueryKey(householdId!, childId!) });
      navigate(growthPath, { replace: true });
    },
    onError: () => {
      toast.error(t('growth.validation.saveFailed'));
    },
  });

  if (childQuery.isLoading || measurementQuery.isLoading) {
    return <LoadingIndicator />;
  }
  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }
  if (measurementQuery.error || !measurementQuery.data) {
    return <ErrorMessage message={t('growth.validation.loadFailed')} />;
  }

  const measurement = measurementQuery.data;

  const handleSubmit = async (output: GrowthMeasurementFormOutput) => {
    await updateMutation.mutateAsync(output);
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
          <h1 className="text-xl font-bold text-foreground">{t('growth.form.titleEdit')}</h1>
          <GrowthMeasurementForm
            mode="edit"
            birthDate={childQuery.data.birthDate.slice(0, 10)}
            initialValues={{
              measuredAt: toCalendarDateInputValue(measurement.measuredAt),
              weightKilograms: toInputValue(measurement.weightGrams, gramsToKilograms),
              lengthCentimetres: toInputValue(
                measurement.lengthMillimeters,
                millimetresToCentimetres,
              ),
              headCircumferenceCentimetres: toInputValue(
                measurement.headCircumferenceMillimeters,
                millimetresToCentimetres,
              ),
              // The stored override, not the effective method: reopening the
              // form must show what the user actually chose, so leaving it on
              // "automatic" does not silently freeze the age-derived value.
              position: measurement.lengthMeasurementPosition,
              note: measurement.note ?? '',
            }}
            onSubmit={handleSubmit}
          />
          {updateMutation.isError && <ErrorMessage message={t('growth.validation.saveFailed')} />}
        </Card.Body>
      </Card>
    </section>
  );
}
