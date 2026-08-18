import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ChildHome } from './ChildHome';
import * as childApi from '../api/child-api';
import * as eventApi from '../api/event-api';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';

vi.mock('../api/child-api');
vi.mock('../api/event-api');
vi.mock('../realtime/useHouseholdRoom');

const mockedChildApi = vi.mocked(childApi);
const mockedEventApi = vi.mocked(eventApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

const child: childApi.ChildSummary = {
  id: CHILD_ID,
  householdId: HOUSEHOLD_ID,
  name: 'Alex',
  birthDate: '2025-09-01T00:00:00.000Z',
  hasPhoto: false,
  createdAt: '2025-09-02T00:00:00.000Z',
};

function renderChildHome() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}`]}>
        <Routes>
          <Route path="/households/:householdId/children/:childId" element={<ChildHome />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ChildHome', () => {
  beforeEach(() => {
    // Only `Date` is faked, not `setTimeout`/`setInterval` — the page's
    // greeting and age must be deterministic, but React Query's and
    // `useTick`'s real timers should keep running.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0, 0));

    queryClient.clear();
    mockedChildApi.fetchChild.mockResolvedValue(child);
    mockedEventApi.fetchEventStats.mockResolvedValue({
      sleepHoursToday: 0.5,
      feedingCountToday: 1,
      lastEventAt: {
        FEEDING: new Date(2026, 0, 1, 7, 40, 0).toISOString(),
        SLEEP: new Date(2026, 0, 1, 8, 45, 0).toISOString(),
        DIAPER: null,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the loading indicator while the child query is in flight', () => {
    mockedChildApi.fetchChild.mockReturnValue(new Promise(() => {}));

    renderChildHome();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows an error message when the child cannot be fetched', async () => {
    mockedChildApi.fetchChild.mockRejectedValue(new ApiError(404, 'Not Found'));

    renderChildHome();

    expect(await screen.findByRole('alert')).toHaveTextContent("This child profile wasn't found.");
  });

  it('shows the child name and age in whole months', async () => {
    renderChildHome();

    expect(await screen.findByRole('heading', { name: 'Alex' })).toBeInTheDocument();
    expect(screen.getByText('4 months old')).toBeInTheDocument();
  });

  // Both ends of each band, so an off-by-one boundary constant or a `<`
  // silently turned into a `<=` fails here instead of passing on mid-band times.
  it.each<[string, number, number, string]>([
    ['00:00', 0, 0, 'Good morning 👋'],
    ['11:59', 11, 59, 'Good morning 👋'],
    ['12:00', 12, 0, 'Good afternoon ☀️'],
    ['17:59', 17, 59, 'Good afternoon ☀️'],
    ['18:00', 18, 0, 'Good evening 🌙'],
    ['23:59', 23, 59, 'Good evening 🌙'],
  ])('greets with the local time of day (%s)', async (_label, hour, minute, expectedGreeting) => {
    vi.setSystemTime(new Date(2026, 0, 1, hour, minute, 0));

    renderChildHome();

    expect(await screen.findByRole('heading', { name: expectedGreeting })).toBeInTheDocument();
  });

  it('renders one elapsed-time badge per event type, colored by type', async () => {
    renderChildHome();

    expect(await screen.findByText('1h ago')).toHaveClass('bg-feeding-bottle');
    expect(screen.getByText('15 min ago')).toHaveClass('bg-sleep');
  });

  it('falls back to the no-entries copy only for the type that has never been logged', async () => {
    renderChildHome();

    await screen.findByText('1h ago');
    expect(screen.getByText('Last diaper change')).toBeInTheDocument();
    expect(screen.getAllByText('No entries yet')).toHaveLength(1);
  });

  it('shows a loading state instead of the badges while the stats query is in flight', async () => {
    mockedEventApi.fetchEventStats.mockReturnValue(new Promise(() => {}));

    renderChildHome();

    // The child card is driven by its own query and must not wait for stats.
    expect(await screen.findByRole('heading', { name: 'Alex' })).toBeInTheDocument();
    expect(screen.getByText('4 months old')).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    // "No entries yet" is a claim about the child's history — not something
    // pending stats are allowed to assert.
    expect(screen.queryByText('No entries yet')).not.toBeInTheDocument();
  });

  it('renders no badges at all, rather than a false no-entries claim, when the stats query fails', async () => {
    mockedEventApi.fetchEventStats.mockRejectedValue(new ApiError(500, 'Internal Server Error'));

    renderChildHome();

    expect(await screen.findByRole('heading', { name: 'Alex' })).toBeInTheDocument();
    expect(screen.getByText('4 months old')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
    expect(screen.queryByText('No entries yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Last diaper change')).not.toBeInTheDocument();
  });

  it('links onward to the daily timeline', async () => {
    renderChildHome();

    const link = await screen.findByRole('link', { name: 'Go to daily timeline' });
    expect(link).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/timeline`,
    );
  });
});
