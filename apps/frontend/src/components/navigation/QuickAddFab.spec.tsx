import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { QuickAddFab } from './QuickAddFab';
import * as diaperApi from '../../api/diaper-api';
import * as feedingApi from '../../api/feeding-api';
import * as sleepApi from '../../api/sleep-api';
import * as useAuthModule from '../../auth/useAuth';
import { queryClient } from '../../lib/query-client';
import { toast } from '../ui';

vi.mock('../../api/diaper-api');
vi.mock('../../api/feeding-api');
vi.mock('../../api/sleep-api');
vi.mock('../../auth/useAuth');

const mockedDiaperApi = vi.mocked(diaperApi);
const mockedFeedingApi = vi.mocked(feedingApi);
const mockedSleepApi = vi.mocked(sleepApi);
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

const BASE = '/households/h1/children/c1';

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderFab() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[BASE]}>
        <QuickAddFab householdId="h1" childId="c1" />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openSheet() {
  const user = userEvent.setup();
  renderFab();
  await user.click(screen.getByRole('button', { name: 'Quick add' }));
  return { user, sheet: await screen.findByRole('dialog', { name: 'Quick add' }) };
}

describe('QuickAddFab', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedUseAuth.mockReturnValue({
      user: { id: 'u1', email: 'parent@example.com', name: 'Bernd', createdAt: '2026-01-01' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      updateName: vi.fn(),
      logout: vi.fn(),
    });
    mockedFeedingApi.fetchActiveFeedingTimer.mockResolvedValue(null);
    mockedSleepApi.fetchActiveSleepTimer.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('is a labelled button that opens the quick-add sheet', async () => {
    const { sheet } = await openSheet();

    for (const section of ['Feeding', 'Sleep', 'Diaper']) {
      expect(within(sheet).getByRole('heading', { name: section })).toBeInTheDocument();
    }
    for (const tile of ['Measurement', 'Milestone', 'Medical']) {
      expect(within(sheet).getByRole('link', { name: tile })).toBeInTheDocument();
    }
  });

  it.each([
    ['Measurement', 'growth/new'],
    ['Milestone', 'milestones/new'],
    ['Medical', 'health/new'],
  ])('sends "%s" straight to its full create form', async (label, path) => {
    const { sheet } = await openSheet();

    expect(within(sheet).getByRole('link', { name: label })).toHaveAttribute(
      'href',
      `${BASE}/${path}`,
    );
  });

  // The PRD's tap budget (section 6): a standard event in at most two taps.
  it('logs a diaper in two taps from anywhere — the FAB, then the type', async () => {
    const success = vi.spyOn(toast, 'success');
    mockedDiaperApi.createDiaperEventOptimistic.mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderFab();

    await user.click(screen.getByRole('button', { name: 'Quick add' })); // tap 1
    await user.click(await screen.findByRole('button', { name: 'Pee' })); // tap 2

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockedDiaperApi.createDiaperEventOptimistic).toHaveBeenCalledWith('h1', 'c1', 'u1', {
      diaperType: 'PEE',
    });
    expect(success).toHaveBeenCalledWith('Diaper logged');
  });

  it('starts breastfeeding in two taps and opens the feeding screen with the timer', async () => {
    mockedFeedingApi.createFeedingEventOptimistic.mockResolvedValue({} as never);
    const { user } = await openSheet();

    await user.click(await screen.findByRole('button', { name: 'Breastfeed left' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(`${BASE}/feeding`),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('points to a running feeding timer instead of offering a second one', async () => {
    mockedFeedingApi.fetchActiveFeedingTimer.mockResolvedValue({ id: 'running' } as never);
    await openSheet();

    expect(await screen.findByText('A breastfeeding session is running.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open timer' })).toHaveAttribute(
      'href',
      `${BASE}/feeding`,
    );
    expect(screen.queryByRole('button', { name: 'Breastfeed left' })).not.toBeInTheDocument();
    // The other sections are unaffected by the running feeding timer.
    expect(screen.getByRole('button', { name: 'Start sleep' })).toBeInTheDocument();
  });

  it('opens the sleep screen after starting a sleep timer, where the timer runs', async () => {
    mockedSleepApi.createSleepEventOptimistic.mockResolvedValue({} as never);
    const { user } = await openSheet();

    await user.click(await screen.findByRole('button', { name: 'Start sleep' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(`${BASE}/sleep`));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('links each inline section to its backfill form for a specific time', async () => {
    const { sheet } = await openSheet();

    const backfillLinks = within(sheet).getAllByRole('link', { name: 'Log with a specific time' });
    expect(backfillLinks.map((link) => link.getAttribute('href'))).toEqual([
      `${BASE}/feeding/new`,
      `${BASE}/sleep/new`,
      `${BASE}/diaper/new`,
    ]);
  });

  it('drops the quick-entry components’ own "Quick entry" headings inside the sheet', async () => {
    const { sheet } = await openSheet();

    await screen.findByRole('button', { name: 'Pee' });
    expect(within(sheet).queryByText('Quick entry')).not.toBeInTheDocument();
  });
});
