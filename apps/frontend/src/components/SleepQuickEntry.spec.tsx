import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { SleepQuickEntry } from './SleepQuickEntry';
import * as sleepApi from '../api/sleep-api';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';

vi.mock('../api/sleep-api');

const mockedSleepApi = vi.mocked(sleepApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

const summary: sleepApi.SleepEventSummary = {
  id: 'e1',
  childId: CHILD_ID,
  userId: 'u1',
  type: 'SLEEP',
  occurredAt: '2026-01-01T20:00:00.000Z',
  startedAt: '2026-01-01T20:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  createdAt: '2026-01-01T20:00:00.000Z',
};

function renderQuickEntry() {
  return render(
    <QueryClientProvider client={queryClient}>
      <SleepQuickEntry householdId={HOUSEHOLD_ID} childId={CHILD_ID} />
    </QueryClientProvider>,
  );
}

describe('SleepQuickEntry', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('creates a sleep entry with a single tap', async () => {
    mockedSleepApi.createSleepEvent.mockResolvedValueOnce(summary);
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Start sleep' }));

    expect(mockedSleepApi.createSleepEvent).toHaveBeenCalledTimes(1);
    expect(mockedSleepApi.createSleepEvent).toHaveBeenCalledWith(HOUSEHOLD_ID, CHILD_ID, {});
  });

  it('invalidates the sleep-events queries on success', async () => {
    mockedSleepApi.createSleepEvent.mockResolvedValueOnce(summary);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Start sleep' }));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'sleep-events'],
    });
  });

  it('shows a mapped error message when create fails with a 409 (timer conflict)', async () => {
    mockedSleepApi.createSleepEvent.mockRejectedValueOnce(new ApiError(409, {}));
    const user = userEvent.setup();
    renderQuickEntry();

    await user.click(screen.getByRole('button', { name: 'Start sleep' }));

    expect(
      await screen.findByText('A sleep timer is already running for this child.'),
    ).toBeInTheDocument();
  });
});
