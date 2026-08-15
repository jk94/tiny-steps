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
    <section>
      <Link to={`/households/${householdId}/children/${childId}/timeline`}>
        {t('notifications.backLink')}
      </Link>
      <h1>{t('notifications.title')}</h1>

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
    <form onSubmit={handleSubmit}>
      <label>
        <input
          type="checkbox"
          checked={values.feedingReminderEnabled}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, feedingReminderEnabled: event.target.checked }))
          }
        />
        {t('notifications.feedingReminderLabel')}
      </label>

      <label>
        {t('notifications.thresholdLabel')}
        {/* No HTML `min` here on purpose: a `min` constraint makes the browser
            silently block form submission for an out-of-range value, so our
            own i18n validation message (below) would never show. The JS check
            in handleSubmit is the single client-side guard instead. */}
        <input
          type="number"
          value={values.feedingReminderThresholdHours}
          onChange={(event) =>
            setValues((prev) => ({
              ...prev,
              feedingReminderThresholdHours: event.target.valueAsNumber,
            }))
          }
        />
      </label>
      {thresholdError && <ErrorMessage message={thresholdError} />}

      <label>
        <input
          type="checkbox"
          checked={values.dailySummaryEnabled}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, dailySummaryEnabled: event.target.checked }))
          }
        />
        {t('notifications.dailySummaryLabel')}
      </label>

      <label>
        {t('notifications.summaryHourLabel')}
        {/* No HTML `min`/`max` here on purpose, for the same reason as the
            threshold input above: a native range constraint makes the browser
            silently block form submission for an out-of-range value, so our
            own i18n validation message (below) would never show. The JS check
            in handleSubmit is the single client-side guard instead. */}
        <input
          type="number"
          value={values.dailySummaryHourLocal}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, dailySummaryHourLocal: event.target.valueAsNumber }))
          }
        />
      </label>
      {summaryHourError && <ErrorMessage message={summaryHourError} />}

      <button type="submit" disabled={isSaving}>
        {isSaving ? t('notifications.saveButtonPending') : t('notifications.saveButton')}
      </button>

      {isSaved && <p role="status">{t('notifications.saved')}</p>}
      {isError && <ErrorMessage message={t('notifications.saveError')} />}
    </form>
  );
}
