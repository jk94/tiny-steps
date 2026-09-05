import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { MilestoneTimeline } from './MilestoneTimeline';
import type { MilestoneSummary } from '../api/milestone-api';
import * as childApi from '../api/child-api';
import * as householdApi from '../api/household-api';
import * as milestoneApi from '../api/milestone-api';
import * as realtime from '../realtime/useHouseholdRoom';
import * as useAuthModule from '../auth/useAuth';
import { queryClient } from '../lib/query-client';

vi.mock('../api/child-api', async () => {
  const actual = await vi.importActual<typeof childApi>('../api/child-api');
  return { ...actual, fetchChild: vi.fn() };
});
vi.mock('../api/milestone-api', async () => {
  const actual = await vi.importActual<typeof milestoneApi>('../api/milestone-api');
  return { ...actual, listMilestones: vi.fn() };
});
vi.mock('../api/household-api', async () => {
  const actual = await vi.importActual<typeof householdApi>('../api/household-api');
  return { ...actual, listHouseholdMembers: vi.fn(), fetchHousehold: vi.fn() };
});
vi.mock('../realtime/useHouseholdRoom', () => ({ useHouseholdRoom: vi.fn() }));
vi.mock('../auth/useAuth');

const mockedChildApi = vi.mocked(childApi);
const mockedMilestoneApi = vi.mocked(milestoneApi);
const mockedHouseholdApi = vi.mocked(householdApi);
const mockedRealtime = vi.mocked(realtime);
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/milestones`;

const milestone: MilestoneSummary = {
  id: 'm1',
  childId: CHILD_ID,
  userId: 'u1',
  templateKey: 'FIRST_STEPS',
  title: 'First steps',
  category: 'MOTOR',
  achievedAt: '2025-08-20T00:00:00.000Z',
  ageInDaysAtMilestone: 212,
  ageInMonthsAtMilestone: 7,
  note: null,
  createdAt: '2025-08-21T09:00:00.000Z',
  updatedAt: '2025-08-21T09:00:00.000Z',
  photos: [],
};

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[BASE_PATH]}>
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/milestones"
            element={<MilestoneTimeline />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MilestoneTimeline', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedChildApi.fetchChild.mockResolvedValue({
      id: CHILD_ID,
      householdId: HOUSEHOLD_ID,
      name: 'Mia',
      birthDate: '2025-01-20T00:00:00.000Z',
      hasPhoto: false,
      sex: null,
      createdAt: '2025-01-21T00:00:00.000Z',
    });
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([] as never);
    mockedHouseholdApi.fetchHousehold.mockResolvedValue({
      id: HOUSEHOLD_ID,
      name: 'Team Müller',
      role: 'OWNER',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    mockedUseAuth.mockReturnValue({
      user: {
        id: 'u1',
        email: 'parent@example.com',
        name: 'Bernd',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      updateName: vi.fn(),
      logout: vi.fn(),
    });
    mockedMilestoneApi.listMilestones.mockResolvedValue([milestone]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows the recorded timeline and the catalog as two tabs of one screen', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('Milestones — Mia')).toBeInTheDocument();
    expect(screen.getByText('First steps')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: "What's next?" }));

    expect(await screen.findByText('usually between 11 and 16 months')).toBeInTheDocument();
    // The catalog knows what has been recorded, which is why it shares this
    // page's single list query instead of being its own route.
    expect(screen.getByText('Recorded')).toBeInTheDocument();
  });

  it('does not join the realtime household room — milestones are online-only (M-15)', async () => {
    renderPage();

    await screen.findByText('Milestones — Mia');
    expect(mockedRealtime.useHouseholdRoom).not.toHaveBeenCalled();
  });

  it('surfaces a failed list load without hiding the catalog', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.listMilestones.mockRejectedValue(new Error('offline'));

    renderPage();

    expect(
      await screen.findByText('The milestones could not be loaded. Please try again.'),
    ).toBeInTheDocument();

    // The catalog is static, so it is still worth showing — just without the
    // "already recorded" markers.
    await user.click(screen.getByRole('tab', { name: "What's next?" }));
    expect(await screen.findByText('usually between 11 and 16 months')).toBeInTheDocument();
  });

  it('links to the create page', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Add milestone' })).toHaveAttribute(
      'href',
      `${BASE_PATH}/new`,
    );
  });
});
