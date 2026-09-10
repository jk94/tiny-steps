import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import { createHealthRecord, healthRecordsQueryKey } from '../api/health-record-api';
import type { CreateHealthRecordInput } from '../api/health-record-api';
import { mapChildError } from '../child/mapChildError';
import { ErrorMessage } from '../components/ErrorMessage';
import { HealthRecordForm } from '../components/health/HealthRecordForm';
import type { HealthRecordFormOutput } from '../components/health/HealthRecordForm';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Card, toast } from '../components/ui';
import { mapHealthRecordError } from '../health/mapHealthRecordError';

/**
 * Create page for one medication or vaccination.
 *
 * Online-only (MED-15): there is no optimistic write and no offline buffer, so
 * a failed save keeps the user on the form with their input intact and raises a
 * toast. Nothing navigates away and no success state is faked.
 */
export function HealthRecordCreate() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const basePath = `/households/${householdId}/children/${childId}/health`;

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateHealthRecordInput) =>
      createHealthRecord(householdId!, childId!, input),
    onError: (error) => {
      toast.error(t(mapHealthRecordError(error)));
    },
  });

  if (childQuery.isLoading) {
    return <LoadingIndicator />;
  }
  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  const handleSubmit = async (output: HealthRecordFormOutput) => {
    // On create an empty optional is *omitted* rather than sent as `null`:
    // there is no stored value to clear, and the server's kind-specific rules
    // reject an explicit null on a field that belongs to the other kind.
    await createMutation.mutateAsync({
      kind: output.kind,
      name: output.name,
      administeredAt: output.administeredAt ?? undefined,
      dueAt: output.dueAt ?? undefined,
      doseAmount: output.doseAmount ?? undefined,
      doseUnit: output.doseUnit ?? undefined,
      vaccineBatch: output.vaccineBatch ?? undefined,
      note: output.note ?? undefined,
      reminderEnabled: output.reminderEnabled,
    });

    await queryClient.invalidateQueries({
      queryKey: healthRecordsQueryKey(householdId!, childId!),
    });
    await navigate(basePath, { replace: true });
  };

  return (
    <section className="mx-auto w-full max-w-sm">
      <Link
        to={basePath}
        className="mb-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        {t('health.form.backLink')}
      </Link>
      <Card>
        <Card.Body className="flex flex-col gap-4">
          <h1 className="text-xl font-bold text-foreground">{t('health.form.createTitle')}</h1>
          <HealthRecordForm
            mode="create"
            birthDate={childQuery.data.birthDate.slice(0, 10)}
            onSubmit={handleSubmit}
          />
          {createMutation.isError && (
            <ErrorMessage message={t(mapHealthRecordError(createMutation.error))} />
          )}
        </Card.Body>
      </Card>
    </section>
  );
}
