import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { FeedingHome } from './FeedingHome';
import * as childApi from '../api/child-api';
import * as feedingApi from '../api/feeding-api';
import * as useAuthModule from '../auth/useAuth';
import {
  deletePendingEvent,
  listAllPendingEvents,
  putPendingEvent,
} from '../offline/pendingEvents.db';
import { queryClient } from '../lib/query-client';

vi.mock('../api/child-api');
vi.mock('../api/feeding-api');
vi.mock('../auth/useAuth');
vi.mock('../realtime/useHouseholdRoom');

const mockedChildApi = vi.mocked(childApi);
const mockedFeedingApi = vi.mocked(feedingApi);
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

function mockAuthUser() {
  mockedUseAuth.mockReturnValue({
    user: {
      id: 'u1',
      email: 'parent@example.com',
      name: 'Bernd',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    updateName: vi.fn(),
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

const runningTimer: feedingApi.FeedingEventSummary = {
  id: 'e1',
  childId: CHILD_ID,
  userId: 'u1',
  type: 'FEEDING',
  feedingType: 'BREAST',
  occurredAt: '2026-01-01T10:00:00.000Z',
  startedAt: '2026-01-01T10:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  side: 'LEFT',
  amountMl: null,
  note: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

function renderFeedingHome() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding`]}>
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/feeding"
            element={<FeedingHome />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FeedingHome', () => {
  beforeEach(() => {
    queryClient.clear();
    mockAuthUser();
    mockedChildApi.fetchChild.mockResolvedValue(child);
    mockedFeedingApi.listFeedingEvents.mockResolvedValue([]);
  });

  afterEach(async () => {
    vi.resetAllMocks();
    queryClient.clear();
    // The offline layer runs against the shared fake-indexeddb — clear buffered
    // records so a pending-stop test can't leak into the next test.
    for (const record of await listAllPendingEvents()) {
      await deletePendingEvent(record.localId);
    }
  });

  it('renders FeedingQuickEntry when there is no active timer', async () => {
    mockedFeedingApi.fetchActiveFeedingTimer.mockResolvedValueOnce(null);

    renderFeedingHome();

    expect(await screen.findByText('Quick entry')).toBeInTheDocument();
    expect(screen.queryByText('Breastfeeding in progress')).not.toBeInTheDocument();
  });

  // This is the test that verifies "resume timer after reload": a fresh
  // mount (simulating an app restart) with the API mocked to return an
  // in-progress event must show the timer view with zero local-storage/
  // state seeding — the server response alone drives it.
  it('renders FeedingTimer, not FeedingQuickEntry, when the API reports a running timer on a fresh mount', async () => {
    mockedFeedingApi.fetchActiveFeedingTimer.mockResolvedValueOnce(runningTimer);

    renderFeedingHome();

    expect(await screen.findByText('Breastfeeding in progress')).toBeInTheDocument();
    expect(screen.queryByText('Quick entry')).not.toBeInTheDocument();
  });

  it('shows the stopped/optimistic state instead of the ticking timer when a pending stop targets it (JC-2)', async () => {
    mockedFeedingApi.fetchActiveFeedingTimer.mockResolvedValueOnce(runningTimer);
    await putPendingEvent({
      localId: 'local-stop',
      householdId: HOUSEHOLD_ID,
      childId: CHILD_ID,
      eventType: 'FEEDING',
      status: 'pending',
      savedAt: '2026-01-01T10:05:00.000Z',
      summary: { ...runningTimer, endedAt: '2026-01-01T10:05:00.000Z' },
      operation: 'stop',
      targetEventId: runningTimer.id,
      updateInput: { clientTimestamp: '2026-01-01T10:05:00.000Z' },
    });

    renderFeedingHome();

    expect(await screen.findByText('Feeding stopped')).toBeInTheDocument();
    expect(screen.queryByText('Breastfeeding in progress')).not.toBeInTheDocument();
  });

  it('shows the child name in the heading', async () => {
    mockedFeedingApi.fetchActiveFeedingTimer.mockResolvedValueOnce(null);

    renderFeedingHome();

    expect(await screen.findByRole('heading', { name: 'Feeding — Alex' })).toBeInTheDocument();
  });

  it('links to the backfill-create page', async () => {
    mockedFeedingApi.fetchActiveFeedingTimer.mockResolvedValueOnce(null);

    renderFeedingHome();

    const link = await screen.findByRole('link', { name: 'Add entry manually' });
    expect(link).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding/new`,
    );
  });
});
