import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchHousehold } from '../api/household-api';
import { deleteChild, fetchChild, updateChild } from '../api/child-api';
import {
  fetchNotificationSettings,
  updateNotificationSettings,
} from '../api/notification-settings-api';
import type { NotificationSettings as NotificationSettingsValues } from '../api/notification-settings-api';
import { ChildForm } from '../components/ChildForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Button, Card, Input } from '../components/ui';
import { bumpPhotoCacheBust } from '../child/childPhotoCacheBust';
import { mapChildError } from '../child/mapChildError';
import { mapHouseholdError } from '../household/mapHouseholdError';
import { queryClient } from '../lib/query-client';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

const MIN_THRESHOLD_HOURS = 1;
const MIN_HOUR = 0;
const MAX_HOUR = 23;

function notificationSettingsQueryKey(
  householdId: string | undefined,
  childId: string | undefined,
) {
  return ['households', householdId, 'children', childId, 'notification-settings'];
}

/**
 * Per-child settings page: child-profile editing (name/photo/birthdate,
 * OWNER-only delete) plus notification preferences, merged into one page.
 * Formerly two standalone routes/pages (`ChildEdit` + `NotificationSettings`)
 * — `ChildList` now sends a click on the child item straight to the daily
 * timeline instead of an edit screen, so edit access moved here instead.
 */
export function ChildSettings() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  useHouseholdRoom(householdId);
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const householdQuery = useQuery({
    queryKey: ['households', householdId],
    queryFn: () => fetchHousehold(householdId!),
    retry: false,
    enabled: !!householdId,
  });

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const notificationSettingsQuery = useQuery({
    queryKey: notificationSettingsQueryKey(householdId, childId),
    queryFn: () => fetchNotificationSettings(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteChild(householdId!, childId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['households', householdId, 'children'] });
      navigate(`/households/${householdId}`, { replace: true });
    },
  });

  const notificationSettingsMutation = useMutation({
    mutationFn: (values: NotificationSettingsValues) =>
      updateNotificationSettings(householdId!, childId!, values),
    onSuccess: async (saved) => {
      queryClient.setQueryData(notificationSettingsQueryKey(householdId, childId), saved);
      await queryClient.invalidateQueries({
        queryKey: notificationSettingsQueryKey(householdId, childId),
      });
    },
  });

  if (householdQuery.isLoading || childQuery.isLoading || notificationSettingsQuery.isLoading) {
    return <LoadingIndicator />;
  }

  if (householdQuery.error || !householdQuery.data) {
    return <ErrorMessage message={t(mapHouseholdError(householdQuery.error))} />;
  }

  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  if (notificationSettingsQuery.error || !notificationSettingsQuery.data) {
    return <ErrorMessage message={t('notifications.loadError')} />;
  }

  const household = householdQuery.data;
  const child = childQuery.data;

  const handleProfileSubmit = async (formData: FormData) => {
    await updateChild(household.id, child.id, formData);
    // No photo-version field exists server-side, so a successful update
    // that included a new photo bumps the client-side cache-bust counter
    // (see `child/childPhotoCacheBust.ts`) so `<ChildPhoto>` re-fetches
    // instead of serving the browser's cached image.
    if (formData.has('photo')) {
      bumpPhotoCacheBust(child.id);
    }
    await queryClient.invalidateQueries({ queryKey: ['households', household.id, 'children'] });
    navigate(`/households/${household.id}`, { replace: true });
  };

  return (
    <section className="mx-auto w-full max-w-sm">
      <Link
        to={`/households/${household.id}/children/${child.id}/timeline`}
        className="mb-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        {t('settings.backLink')}
      </Link>
      <h1 className="mb-4 text-xl font-bold text-foreground">{t('settings.title')}</h1>

      <div className="flex flex-col gap-3">
        <Card>
          <Card.Body className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-foreground">
              {t('settings.profileSectionTitle')}
            </h2>
            <ChildForm
              mode="edit"
              initialValues={{
                name: child.name,
                // `birthDate` arrives as a full ISO8601 datetime string; an
                // `<input type="date">` value must be the date-only portion.
                birthDate: child.birthDate.slice(0, 10),
                childId: child.id,
                householdId: household.id,
                hasPhoto: child.hasPhoto,
              }}
              onSubmit={handleProfileSubmit}
            />

            {/* Child deletion is OWNER-only server-side (see `ChildController`) —
                completely hidden for a CO_PARENT, not just disabled. */}
            {household.role === 'OWNER' && (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  {t('child.edit.deleteButton')}
                </Button>
                <ConfirmDialog
                  isOpen={isDeleteDialogOpen}
                  title={t('child.edit.deleteDialog.title')}
                  description={t('child.edit.deleteDialog.description')}
                  confirmLabel={t('child.edit.deleteDialog.confirmButton')}
                  cancelLabel={t('child.edit.deleteDialog.cancelButton')}
                  onConfirm={() => deleteMutation.mutate()}
                  onCancel={() => setIsDeleteDialogOpen(false)}
                  isConfirming={deleteMutation.isPending}
                />
                {deleteMutation.isError && (
                  <ErrorMessage message={t(mapChildError(deleteMutation.error))} />
                )}
              </>
            )}
          </Card.Body>
        </Card>

        <Button asChild variant="secondary" className="w-full">
          <Link to={`/households/${household.id}/children/${child.id}/settings/export`}>
            {t('settings.exportButton')}
          </Link>
        </Button>

        <h2 className="text-sm font-bold text-foreground">
          {t('settings.notificationsSectionTitle')}
        </h2>
        <NotificationSettingsForm
          initialValues={notificationSettingsQuery.data}
          onSubmit={(values) => notificationSettingsMutation.mutate(values)}
          isSaving={notificationSettingsMutation.isPending}
          isSaved={notificationSettingsMutation.isSuccess}
          isError={notificationSettingsMutation.isError}
        />
      </div>
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
