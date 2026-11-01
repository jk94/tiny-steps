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
import type { HouseholdRole } from '../lib/householdPermissions';
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

const mockedChildApi = vi.mocked(childApi);
const mockedMilestoneApi = vi.mocked(milestoneApi);
const mockedHouseholdApi = vi.mocked(householdApi);
const mockedRealtime = vi.mocked(realtime);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/milestones`;
/** The author of `milestone` below. */
const CURRENT_USER_ID = 'u1';

const milestone: MilestoneSummary = {
  id: 'm1',
  childId: CHILD_ID,
  userId: CURRENT_USER_ID,
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

/** Resolves the household query `useHouseholdRole` reads the page's role from. */
function givenHouseholdRole(role: HouseholdRole = 'OWNER') {
  mockedHouseholdApi.fetchHousehold.mockResolvedValue({
    id: HOUSEHOLD_ID,
    name: 'Team Müller',
    role,
    createdAt: '2025-01-01T00:00:00.000Z',
  });
}

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
    givenHouseholdRole();
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

  describe('role-dependent actions', () => {
    it.each(['OWNER', 'CO_PARENT', 'CAREGIVER'] as const)(
      'offers the "add milestone" link to a %s',
      async (role) => {
        givenHouseholdRole(role);

        renderPage();

        expect(await screen.findByRole('link', { name: 'Add milestone' })).toBeInTheDocument();
      },
    );

    it('hides the "add milestone" link from an OBSERVER while keeping the timeline readable', async () => {
      givenHouseholdRole('OBSERVER');

      renderPage();

      expect(await screen.findByText('First steps')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Add milestone' })).not.toBeInTheDocument();
    });

    it('drops the empty-state call to action for an OBSERVER but keeps the statement', async () => {
      givenHouseholdRole('OBSERVER');
      mockedMilestoneApi.listMilestones.mockResolvedValue([]);

      renderPage();

      expect(await screen.findByText('No milestones yet')).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Record the first milestone' }),
      ).not.toBeInTheDocument();
    });

    // Editing and deleting moved to the detail screen (`MilestoneDetail`):
    // the timeline is an album of tiles that only ever navigate.
    it.each(['OWNER', 'CAREGIVER', 'OBSERVER'] as const)(
      'offers a %s no edit/delete action on the timeline itself, only the tile link',
      async (role) => {
        givenHouseholdRole(role);

        renderPage();

        const tile = await screen.findByRole('link', { name: /First steps/ });
        expect(tile).toHaveAttribute('href', `${BASE_PATH}/m1`);
        expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
      },
    );
  });
});
