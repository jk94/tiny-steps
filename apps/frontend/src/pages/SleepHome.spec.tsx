import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SleepHome } from './SleepHome';
import * as childApi from '../api/child-api';
import * as sleepApi from '../api/sleep-api';
import * as useAuthModule from '../auth/useAuth';
import {
  deletePendingEvent,
  listAllPendingEvents,
  putPendingEvent,
} from '../offline/pendingEvents.db';
import { queryClient } from '../lib/query-client';

vi.mock('../api/child-api');
vi.mock('../api/sleep-api');
vi.mock('../auth/useAuth');
vi.mock('../realtime/useHouseholdRoom');

const mockedChildApi = vi.mocked(childApi);
const mockedSleepApi = vi.mocked(sleepApi);
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

function mockAuthUser() {
  mockedUseAuth.mockReturnValue({
    user: { id: 'u1', email: 'parent@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  });
}

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

const child: childApi.ChildSummary = {
  id: CHILD_ID,
  householdId: HOUSEHOLD_ID,
  name: 'Alex',
  birthDate: '2024-01-01T00:00:00.000Z',
  hasPhoto: false,
  createdAt: '2024-01-02T00:00:00.000Z',
};

const runningTimer: sleepApi.SleepEventSummary = {
  id: 'e1',
  childId: CHILD_ID,
  userId: 'u1',
  type: 'SLEEP',
  occurredAt: '2026-01-01T20:00:00.000Z',
  startedAt: '2026-01-01T20:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  createdAt: '2026-01-01T20:00:00.000Z',
  updatedAt: '2026-01-01T20:00:00.000Z',
};

function renderSleepHome() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/sleep`]}>
        <Routes>
          <Route path="/households/:householdId/children/:childId/sleep" element={<SleepHome />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SleepHome', () => {
  beforeEach(() => {
    queryClient.clear();
    mockAuthUser();
    mockedChildApi.fetchChild.mockResolvedValue(child);
    mockedSleepApi.listSleepEvents.mockResolvedValue([]);
  });

  afterEach(async () => {
    vi.resetAllMocks();
    queryClient.clear();
    for (const record of await listAllPendingEvents()) {
      await deletePendingEvent(record.localId);
    }
  });

  it('shows the stopped/optimistic state instead of the ticking timer when a pending stop targets it (JC-2)', async () => {
    mockedSleepApi.fetchActiveSleepTimer.mockResolvedValueOnce(runningTimer);
    await putPendingEvent({
      localId: 'local-stop',
      householdId: HOUSEHOLD_ID,
      childId: CHILD_ID,
      eventType: 'SLEEP',
      status: 'pending',
      savedAt: '2026-01-01T20:05:00.000Z',
      summary: { ...runningTimer, endedAt: '2026-01-01T20:05:00.000Z' },
      operation: 'stop',
      targetEventId: runningTimer.id,
      updateInput: { clientTimestamp: '2026-01-01T20:05:00.000Z' },
    });

    renderSleepHome();

    expect(await screen.findByText('Sleep stopped')).toBeInTheDocument();
    expect(screen.queryByText('Sleep in progress')).not.toBeInTheDocument();
  });

  it('renders SleepQuickEntry when there is no active timer', async () => {
    mockedSleepApi.fetchActiveSleepTimer.mockResolvedValueOnce(null);

    renderSleepHome();

    expect(await screen.findByText('Quick entry')).toBeInTheDocument();
    expect(screen.queryByText('Sleep in progress')).not.toBeInTheDocument();
  });

  // This is the test that verifies "resume timer after reload": a fresh
  // mount (simulating an app restart) with the API mocked to return an
  // in-progress event must show the timer view with zero local-storage/
  // state seeding — the server response alone drives it.
  it('renders SleepTimer, not SleepQuickEntry, when the API reports a running timer on a fresh mount', async () => {
    mockedSleepApi.fetchActiveSleepTimer.mockResolvedValueOnce(runningTimer);

    renderSleepHome();

    expect(await screen.findByText('Sleep in progress')).toBeInTheDocument();
    expect(screen.queryByText('Quick entry')).not.toBeInTheDocument();
  });

  it('shows the child name in the heading', async () => {
    mockedSleepApi.fetchActiveSleepTimer.mockResolvedValueOnce(null);

    renderSleepHome();

    expect(await screen.findByRole('heading', { name: 'Sleep — Alex' })).toBeInTheDocument();
  });

  it('links to the backfill-create page', async () => {
    mockedSleepApi.fetchActiveSleepTimer.mockResolvedValueOnce(null);

    renderSleepHome();

    const link = await screen.findByRole('link', { name: 'Add entry manually' });
    expect(link).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/sleep/new`,
    );
  });
});
