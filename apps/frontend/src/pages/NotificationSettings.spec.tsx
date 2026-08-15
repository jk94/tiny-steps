import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { NotificationSettings } from './NotificationSettings';
import * as api from '../api/notification-settings-api';
import type { NotificationSettings as Settings } from '../api/notification-settings-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/notification-settings-api');

const mockedApi = vi.mocked(api);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

const settings: Settings = {
  feedingReminderEnabled: true,
  feedingReminderThresholdHours: 4,
  dailySummaryEnabled: true,
  dailySummaryHourLocal: 20,
};

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/notifications`]}
      >
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/notifications"
            element={<NotificationSettings />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationSettings page', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedApi.fetchNotificationSettings.mockResolvedValue(settings);
    mockedApi.updateNotificationSettings.mockImplementation((_h, _c, values) =>
      Promise.resolve(values),
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows a loading indicator while settings load', () => {
    mockedApi.fetchNotificationSettings.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('seeds the form from the fetched settings', async () => {
    renderPage();

    expect(await screen.findByRole('checkbox', { name: 'Feeding reminder' })).toBeChecked();
    expect(screen.getByLabelText('Remind after (hours)')).toHaveValue(4);
    expect(screen.getByRole('checkbox', { name: 'Daily summary' })).toBeChecked();
    expect(screen.getByLabelText('Summary hour (0–23)')).toHaveValue(20);
  });

  it('saves edited values via updateNotificationSettings', async () => {
    const user = userEvent.setup();
    renderPage();

    const threshold = await screen.findByLabelText('Remind after (hours)');
    await user.clear(threshold);
    await user.type(threshold, '6');
    await user.click(screen.getByRole('checkbox', { name: 'Daily summary' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedApi.updateNotificationSettings).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, {
      feedingReminderEnabled: true,
      feedingReminderThresholdHours: 6,
      dailySummaryEnabled: false,
      dailySummaryHourLocal: 20,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Settings saved.');
  });

  it('rejects a non-positive threshold client-side without calling the API', async () => {
    const user = userEvent.setup();
    renderPage();

    const threshold = await screen.findByLabelText('Remind after (hours)');
    await user.clear(threshold);
    await user.type(threshold, '0');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedApi.updateNotificationSettings).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please enter a whole number of hours (at least 1).',
    );
  });

  it('shows an error when settings fail to load', async () => {
    mockedApi.fetchNotificationSettings.mockRejectedValue(new Error('boom'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load your notification settings.",
    );
  });
});
