import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import {
  fetchNotificationSettings,
  updateNotificationSettings,
} from '../api/notification-settings-api';
import type { NotificationSettings as NotificationSettingsValues } from '../api/notification-settings-api';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Button, Card, Input } from '../components/ui';
import { queryClient } from '../lib/query-client';

const MIN_THRESHOLD_HOURS = 1;
const MIN_HOUR = 0;
const MAX_HOUR = 23;

function settingsQueryKey(householdId: string | undefined, childId: string | undefined) {
  return ['households', householdId, 'children', childId, 'notification-settings'];
}

/**
 * Per-child notification settings page — feeding-reminder toggle + threshold,
 * daily-summary toggle + hour. Follows `ChildEdit`'s load-gate pattern
 * (`useQuery` → LoadingIndicator/ErrorMessage → seeded form), with the actual
 * form extracted so its local state is seeded once from loaded data.
 */
export function NotificationSettings() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();

  const settingsQuery = useQuery({
    queryKey: settingsQueryKey(householdId, childId),
    queryFn: () => fetchNotificationSettings(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const mutation = useMutation({
    mutationFn: (values: NotificationSettingsValues) =>
      updateNotificationSettings(householdId!, childId!, values),
    onSuccess: async (saved) => {
      queryClient.setQueryData(settingsQueryKey(householdId, childId), saved);
      await queryClient.invalidateQueries({
        queryKey: settingsQueryKey(householdId, childId),
      });
    },
  });

  return (
    <section className="mx-auto w-full max-w-sm">
      <Link
        to={`/households/${householdId}/children/${childId}/timeline`}
        className="mb-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        {t('notifications.backLink')}
      </Link>
      <h1 className="mb-4 text-xl font-bold text-foreground">{t('notifications.title')}</h1>

      {settingsQuery.isLoading ? (
        <LoadingIndicator />
      ) : settingsQuery.error || !settingsQuery.data ? (
        <ErrorMessage message={t('notifications.loadError')} />
      ) : (
        <NotificationSettingsForm
          initialValues={settingsQuery.data}
          onSubmit={(values) => mutation.mutate(values)}
          isSaving={mutation.isPending}
          isSaved={mutation.isSuccess}
          isError={mutation.isError}
        />
      )}
    </section>
  );
}

interface NotificationSettingsFormProps {
  initialValues: NotificationSettingsValues;
  onSubmit: (values: NotificationSettingsValues) => void;
  isSaving: boolean;
  isSaved: boolean;
  isError: boolean;
}

/** Toggle switch built on a real checkbox (`peer`), styled as an on/off track + thumb. */
function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="pointer-events-none absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-primary" />
        <span className="pointer-events-none absolute left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function NotificationSettingsForm({
  initialValues,
  onSubmit,
  isSaving,
  isSaved,
  isError,
}: NotificationSettingsFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<NotificationSettingsValues>(initialValues);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [summaryHourError, setSummaryHourError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !Number.isInteger(values.feedingReminderThresholdHours) ||
      values.feedingReminderThresholdHours < MIN_THRESHOLD_HOURS
    ) {
      setThresholdError(t('notifications.thresholdInvalid'));
      return;
    }
    setThresholdError(null);
    if (
      !Number.isInteger(values.dailySummaryHourLocal) ||
      values.dailySummaryHourLocal < MIN_HOUR ||
      values.dailySummaryHourLocal > MAX_HOUR
    ) {
      setSummaryHourError(t('notifications.summaryHourInvalid'));
      return;
    }
    setSummaryHourError(null);
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Card>
        <Card.Body className="flex flex-col gap-3">
          <ToggleField
            label={t('notifications.feedingReminderLabel')}
            checked={values.feedingReminderEnabled}
            onChange={(checked) =>
              setValues((prev) => ({ ...prev, feedingReminderEnabled: checked }))
            }
          />
          {/* No HTML `min` here on purpose: a `min` constraint makes the browser
              silently block form submission for an out-of-range value, so our
              own i18n validation message (below) would never show. The JS check
              in handleSubmit is the single client-side guard instead. */}
          <Input
            label={t('notifications.thresholdLabel')}
            type="number"
            value={values.feedingReminderThresholdHours}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                feedingReminderThresholdHours: event.target.valueAsNumber,
              }))
            }
            error={thresholdError ?? undefined}
          />
        </Card.Body>
      </Card>

      <Card>
        <Card.Body className="flex flex-col gap-3">
          <ToggleField
            label={t('notifications.dailySummaryLabel')}
            checked={values.dailySummaryEnabled}
            onChange={(checked) => setValues((prev) => ({ ...prev, dailySummaryEnabled: checked }))}
          />
          {/* No HTML `min`/`max` here on purpose, for the same reason as the
              threshold input above: a native range constraint makes the browser
              silently block form submission for an out-of-range value, so our
              own i18n validation message (below) would never show. The JS check
              in handleSubmit is the single client-side guard instead. */}
          <Input
            label={t('notifications.summaryHourLabel')}
            type="number"
            value={values.dailySummaryHourLocal}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, dailySummaryHourLocal: event.target.valueAsNumber }))
            }
            error={summaryHourError ?? undefined}
          />
        </Card.Body>
      </Card>

      <Button type="submit" variant="primary" className="w-full" isLoading={isSaving}>
        {isSaving ? t('notifications.saveButtonPending') : t('notifications.saveButton')}
      </Button>

      {isSaved && (
        <p role="status" className="text-sm text-success">
          {t('notifications.saved')}
        </p>
      )}
      {isError && <ErrorMessage message={t('notifications.saveError')} />}
    </form>
  );
}
