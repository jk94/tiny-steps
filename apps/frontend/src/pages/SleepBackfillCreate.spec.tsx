import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SleepBackfillCreate } from './SleepBackfillCreate';
import * as sleepApi from '../api/sleep-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/sleep-api');
vi.mock('../realtime/useHouseholdRoom');

const mockedSleepApi = vi.mocked(sleepApi);

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

const created: sleepApi.SleepEventSummary = {
  id: 'e1',
  childId: CHILD_ID,
  userId: 'u1',
  type: 'SLEEP',
  occurredAt: '2026-01-01T20:00:00.000Z',
  startedAt: '2026-01-01T20:00:00.000Z',
  endedAt: '2026-01-02T06:00:00.000Z',
  durationSeconds: 36000,
  createdAt: '2026-01-01T20:00:00.000Z',
};

function renderBackfillCreate() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/sleep/new`]}>
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/sleep/new"
            element={<SleepBackfillCreate />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SleepBackfillCreate', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('renders the SleepEventForm in create mode', () => {
    renderBackfillCreate();

    expect(screen.getByRole('heading', { name: 'Add sleep entry' })).toBeInTheDocument();
    expect(screen.getByLabelText('Time')).toBeEnabled();
  });

  it('creates the entry, invalidates the sleep-events query, and navigates back to sleep home', async () => {
    mockedSleepApi.createSleepEvent.mockResolvedValueOnce(created);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    renderBackfillCreate();

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '2026-01-01T20:00' } });
    fireEvent.change(screen.getByLabelText('End time (optional)'), {
      target: { value: '2026-01-02T06:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(mockedSleepApi.createSleepEvent).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      expect.objectContaining({ occurredAt: new Date('2026-01-01T20:00').toISOString() }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'sleep-events'],
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/sleep`,
      {
        replace: true,
      },
    );
  });
});
