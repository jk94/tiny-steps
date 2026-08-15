import { apiFetch } from './http-client';

/**
 * Mirrors the backend's `NotificationSettingsView` (see
 * `apps/backend/src/notification/notification-settings.service.ts`) — the four
 * editable fields, per (user, child).
 */
export interface NotificationSettings {
  feedingReminderEnabled: boolean;
  feedingReminderThresholdHours: number;
  dailySummaryEnabled: boolean;
  dailySummaryHourLocal: number;
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
