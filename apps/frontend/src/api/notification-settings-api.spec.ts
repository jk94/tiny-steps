import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import { fetchNotificationSettings, updateNotificationSettings } from './notification-settings-api';
import type { NotificationSettings } from './notification-settings-api';

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(httpClient.apiFetch);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/notification-settings`;

const settings: NotificationSettings = {
  feedingReminderEnabled: true,
  feedingReminderThresholdHours: 4,
  dailySummaryEnabled: true,
  dailySummaryHourLocal: 20,
};

describe('notification-settings-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('fetchNotificationSettings GETs the settings sub-route', async () => {
    mockedApiFetch.mockResolvedValueOnce(settings);

    const result = await fetchNotificationSettings(HOUSEHOLD_ID, CHILD_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(PATH);
    expect(result).toEqual(settings);
  });

  it('updateNotificationSettings PUTs the settings body', async () => {
    const updated = { ...settings, feedingReminderThresholdHours: 6 };
    mockedApiFetch.mockResolvedValueOnce(updated);

    const result = await updateNotificationSettings(HOUSEHOLD_ID, CHILD_ID, updated);

    expect(mockedApiFetch).toHaveBeenCalledWith(PATH, {
      method: 'PUT',
      body: { ...updated },
    });
    expect(result).toEqual(updated);
  });
});
