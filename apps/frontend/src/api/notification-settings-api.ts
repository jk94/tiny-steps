import { apiFetch } from './http-client';

/**
 * Mirrors the backend's `NotificationSettingsView` (see
 * `apps/backend/src/notification/notification-settings.service.ts`) — the
 * editable fields, per (user, child).
 *
 * The medical-reminder de-duplication state is deliberately absent: unlike the
 * feeding reminder it does not live here at all, but per record on
 * `HealthRecord.reminderLastSentAt` (MED-9).
 */
export interface NotificationSettings {
  feedingReminderEnabled: boolean;
  feedingReminderThresholdHours: number;
  dailySummaryEnabled: boolean;
  dailySummaryHourLocal: number;
  medicalReminderEnabled: boolean;
  medicalReminderLeadDays: number;
}

function settingsPath(householdId: string, childId: string): string {
  return `/households/${householdId}/children/${childId}/notification-settings`;
}

export function fetchNotificationSettings(
  householdId: string,
  childId: string,
): Promise<NotificationSettings> {
  return apiFetch<NotificationSettings>(settingsPath(householdId, childId));
}

export function updateNotificationSettings(
  householdId: string,
  childId: string,
  settings: NotificationSettings,
): Promise<NotificationSettings> {
  return apiFetch<NotificationSettings>(settingsPath(householdId, childId), {
    method: 'PUT',
    body: { ...settings },
  });
}
