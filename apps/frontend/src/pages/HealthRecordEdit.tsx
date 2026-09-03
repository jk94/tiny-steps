import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import {
  fetchHealthRecord,
  healthRecordQueryKey,
  healthRecordsQueryKey,
  updateHealthRecord,
} from '../api/health-record-api';
import type { UpdateHealthRecordInput } from '../api/health-record-api';
import { mapChildError } from '../child/mapChildError';
import { ErrorMessage } from '../components/ErrorMessage';
import { HealthRecordForm } from '../components/health/HealthRecordForm';
import type { HealthRecordFormOutput } from '../components/health/HealthRecordForm';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Card, toast } from '../components/ui';
import { mapHealthRecordError } from '../health/mapHealthRecordError';
import { toCalendarDateInputValue } from '../lib/calendarDate';

/** Converts a backend ISO 8601 instant into a local `datetime-local` input value. */
function isoToDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 16);
}

/**
 * Edit page for one medication or vaccination (MED-14).
 *
 * Online-only (MED-15), exactly like the create page: a failed PATCH keeps the
 * user on the form and raises a toast rather than buffering the edit.
 *
 * This is also where a mis-tapped "mark as done" is corrected (MED-5): that
 * action only sets `administeredAt`, and the field is fully editable here.
 */
export function HealthRecordEdit() {
  const { t } = useTranslation();
  const { householdId, childId, recordId } = useParams<{
    householdId: string;
    childId: string;
    recordId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const basePath = `/households/${householdId}/children/${childId}/health`;

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const recordQuery = useQuery({
    queryKey: healthRecordQueryKey(householdId!, childId!, recordId!),
    queryFn: () => fetchHealthRecord(householdId!, childId!, recordId!),
    retry: false,
    enabled: !!householdId && !!childId && !!recordId,
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateHealthRecordInput) =>
      updateHealthRecord(householdId!, childId!, recordId!, input),
    onError: (error) => {
      toast.error(t(mapHealthRecordError(error)));
    },
  });

  if (childQuery.isLoading || recordQuery.isLoading) {
    return <LoadingIndicator />;
  }
  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }
  if (recordQuery.error || !recordQuery.data) {
    return <ErrorMessage message={t(mapHealthRecordError(recordQuery.error))} />;
  }

  const record = recordQuery.data;

  const handleSubmit = async (output: HealthRecordFormOutput) => {
    // On edit an emptied optional is an explicit `null`, which the PATCH
    // endpoint reads as "clear it" rather than "leave it alone". `kind` is
    // never sent — it is not editable.
    await updateMutation.mutateAsync({
      name: output.name,
      administeredAt: output.administeredAt,
      dueAt: output.dueAt,
      doseAmount: output.doseAmount,
      doseUnit: output.doseUnit,
      vaccineBatch: output.vaccineBatch,
      note: output.note,
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
          <h1 className="text-xl font-bold text-foreground">{t('health.form.editTitle')}</h1>
          <HealthRecordForm
            mode="edit"
            birthDate={childQuery.data.birthDate.slice(0, 10)}
            initialValues={{
              kind: record.kind,
              name: record.name,
              administeredAt: record.administeredAt
                ? isoToDatetimeLocalValue(record.administeredAt)
                : '',
              dueAt: record.dueAt ? toCalendarDateInputValue(record.dueAt) : '',
              doseAmount: record.doseAmount !== null ? String(record.doseAmount) : '',
              doseUnit: record.doseUnit ?? '',
              vaccineBatch: record.vaccineBatch ?? '',
              note: record.note ?? '',
              reminderEnabled: record.reminderEnabled,
            }}
            onSubmit={handleSubmit}
          />
          {updateMutation.isError && (
            <ErrorMessage message={t(mapHealthRecordError(updateMutation.error))} />
          )}
        </Card.Body>
      </Card>
    </section>
  );
}
