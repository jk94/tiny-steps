import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { FeedingHome } from './FeedingHome';
import * as httpClient from '../api/http-client';
import * as useAuthModule from '../auth/useAuth';
import { deletePendingEvent, listAllPendingEvents } from '../offline/pendingEvents.db';
import { drainPendingEventQueue } from '../offline/syncQueue';
import { queryClient } from '../lib/query-client';

// Deliberately does NOT mock '../api/feeding-api' or '../api/child-api' — only
// the network seam (`apiFetch`) is mocked, so the real
// `stopFeedingTimerOptimistic` → `updateEventOptimistically` → query
// invalidation chain runs end to end, same as `updateOptimistic.integration
// .spec.ts` does for edits. This is what actually proves clicking "Stop"
// makes `FeedingHome` switch away from the ticking timer.
vi.mock('../api/http-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/http-client')>();
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('../auth/useAuth');
vi.mock('../realtime/useHouseholdRoom');

const mockedFetch = vi.mocked(httpClient.apiFetch);
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const EVENT_ID = 'e1';

const child = {
  id: CHILD_ID,
  householdId: HOUSEHOLD_ID,
  name: 'Alex',
  birthDate: '2024-01-01T00:00:00.000Z',
  hasPhoto: false,
  createdAt: '2024-01-02T00:00:00.000Z',
};

const runningTimer = {
  id: EVENT_ID,
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

describe('FeedingHome stop-timer flow (integration)', () => {
  beforeEach(() => {
    queryClient.clear();
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
  });

  afterEach(async () => {
    vi.resetAllMocks();
    queryClient.clear();
    for (const record of await listAllPendingEvents()) {
      await deletePendingEvent(record.localId);
    }
  });

  it('switches from the ticking timer to Quick entry once Stop resolves, without reverting to "still running" (the flicker/race regression)', async () => {
    let stopped = false;
    const stoppedEvent = {
      ...runningTimer,
      endedAt: '2026-01-01T10:05:00.000Z',
      durationSeconds: 300,
    };

    mockedFetch.mockImplementation(async (path: string, options?: { method?: string }) => {
      const method = options?.method?.toUpperCase() ?? 'GET';
      if (path === `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}`) {
        return child;
      }
      if (path === `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding-events/active-timer`) {
        return stopped ? null : runningTimer;
      }
      if (path === `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding-events`) {
        return [];
      }
      if (
        path ===
          `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding-events/${EVENT_ID}/stop` &&
        method === 'POST'
      ) {
        stopped = true;
        return stoppedEvent;
      }
      throw new Error(`Unexpected apiFetch call: ${method} ${path}`);
    });

    const user = userEvent.setup();
    renderFeedingHome();

    expect(await screen.findByText('Breastfeeding in progress')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    // The final, settled state must be Quick entry — the timer must not be
    // stuck showing "still running" forever (the bug under test).
    await waitFor(() => {
      expect(screen.getByText('Quick entry')).toBeInTheDocument();
    });
    expect(screen.queryByText('Breastfeeding in progress')).not.toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();

    // Exactly one stop request was ever sent — no phantom second click/resend.
    const stopCalls = mockedFetch.mock.calls.filter(
      ([path, options]) =>
        path ===
          `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding-events/${EVENT_ID}/stop` &&
        (options as { method?: string } | undefined)?.method?.toUpperCase() === 'POST',
    );
    expect(stopCalls).toHaveLength(1);
  });

  it('does not get stuck showing the ticking timer when the sync-queue drains the buffered stop concurrently (e.g. an incidental WebSocket reconnect)', async () => {
    // Regression for the bug that persisted after the first fix: a
    // `drainPendingEventQueue()` run (triggered by `SyncQueueProvider` on
    // *any* reconnect, unrelated to this click) can race the user's own
    // in-flight stop request. Here the drain's resend reaches the server
    // *first* (it's a plain, non-blocking call), so the user's own original
    // request — deliberately held open to simulate real network latency —
    // later resolves into an EVENT_ALREADY_STOPPED 409. Both code paths must
    // leave `FeedingHome` on Quick entry, not stuck flickering back to the
    // ticking timer.
    let stopped = false;
    let stopCallCount = 0;
    const stoppedEvent = {
      ...runningTimer,
      endedAt: '2026-01-01T10:05:00.000Z',
      durationSeconds: 300,
    };
    let resolveOwnStopRequest: (() => void) | undefined;
    let notifyOwnStopRequestStarted: (() => void) | undefined;
    const ownStopRequestStarted = new Promise<void>((resolve) => {
      notifyOwnStopRequestStarted = resolve;
    });

    mockedFetch.mockImplementation(async (path: string, options?: { method?: string }) => {
      const method = options?.method?.toUpperCase() ?? 'GET';
      if (path === `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}`) {
        return child;
      }
      if (path === `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding-events/active-timer`) {
        return stopped ? null : runningTimer;
      }
      if (path === `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding-events`) {
        return [];
      }
      if (
        path ===
          `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding-events/${EVENT_ID}/stop` &&
        method === 'POST'
      ) {
        stopCallCount += 1;
        if (stopCallCount === 1) {
          // The user's own original request (fired first, chronologically) —
          // held open until the test explicitly settles it, simulating
          // network latency long enough for a concurrent drain to land.
          notifyOwnStopRequestStarted?.();
          return new Promise((_resolve, reject) => {
            resolveOwnStopRequest = () =>
              reject(
                new httpClient.ApiError(409, {
                  code: 'EVENT_ALREADY_STOPPED',
                  currentEvent: stoppedEvent,
                }),
              );
          });
        }
        // The sync-queue's concurrent resend — reaches the server first.
        stopped = true;
        return stoppedEvent;
      }
      throw new Error(`Unexpected apiFetch call: ${method} ${path}`);
    });

    const user = userEvent.setup();
    renderFeedingHome();

    expect(await screen.findByText('Breastfeeding in progress')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    await ownStopRequestStarted;

    // The buffered 'stop' record now exists in IndexedDB while the user's own
    // request is still in flight — exactly the "in-flight overlap" window a
    // concurrent drain can land in.
    await drainPendingEventQueue();

    // Let the user's own delayed request settle with its redundant-stop 409.
    resolveOwnStopRequest?.();

    await waitFor(() => {
      expect(screen.getByText('Quick entry')).toBeInTheDocument();
    });
    expect(screen.queryByText('Breastfeeding in progress')).not.toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();

    // No permanent "not saved" ghost is left behind either.
    expect(await listAllPendingEvents()).toHaveLength(0);
  });
});
