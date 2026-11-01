import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { MilestoneDetail } from './MilestoneDetail';
import type { MilestoneSummary } from '../api/milestone-api';
import * as householdApi from '../api/household-api';
import * as milestoneApi from '../api/milestone-api';
import * as useAuthModule from '../auth/useAuth';
import type { HouseholdRole } from '../lib/householdPermissions';
import { queryClient } from '../lib/query-client';

vi.mock('../api/milestone-api', async () => {
  const actual = await vi.importActual<typeof milestoneApi>('../api/milestone-api');
  return { ...actual, fetchMilestone: vi.fn(), deleteMilestone: vi.fn() };
});
vi.mock('../api/household-api', async () => {
  const actual = await vi.importActual<typeof householdApi>('../api/household-api');
  return { ...actual, listHouseholdMembers: vi.fn(), fetchHousehold: vi.fn() };
});
vi.mock('../auth/useAuth');

const mockedMilestoneApi = vi.mocked(milestoneApi);
const mockedHouseholdApi = vi.mocked(householdApi);
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const MILESTONE_ID = 'm1';
const LIST_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/milestones`;
const OWN_ID = 'u1';
const FOREIGN_ID = 'u2';

function makeMilestone(overrides: Partial<MilestoneSummary> = {}): MilestoneSummary {
  return {
    id: MILESTONE_ID,
    childId: CHILD_ID,
    userId: OWN_ID,
    templateKey: 'FIRST_STEPS',
    title: 'First steps',
    category: 'MOTOR',
    achievedAt: '2025-08-20T00:00:00.000Z',
    ageInDaysAtMilestone: 212,
    ageInMonthsAtMilestone: 7,
    note: 'Three steps towards the cat.',
    createdAt: '2025-08-21T09:00:00.000Z',
    updatedAt: '2025-08-21T09:00:00.000Z',
    photos: [],
    ...overrides,
  };
}

function givenRole(role: HouseholdRole) {
  mockedHouseholdApi.fetchHousehold.mockResolvedValue({
    id: HOUSEHOLD_ID,
    name: 'Team Müller',
    role,
    createdAt: '2025-01-01T00:00:00.000Z',
  });
}

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`${LIST_PATH}/${MILESTONE_ID}`]}>
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/milestones/:milestoneId"
            element={<MilestoneDetail />}
          />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MilestoneDetail', () => {
  beforeEach(() => {
    queryClient.clear();
    givenRole('OWNER');
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([
      { userId: OWN_ID, email: 'parent@example.com', role: 'OWNER', joinedAt: '2025-01-01' },
    ] as never);
    mockedMilestoneApi.fetchMilestone.mockResolvedValue(makeMilestone());
    mockedUseAuth.mockReturnValue({
      user: { id: OWN_ID, email: 'parent@example.com', name: 'Bernd', createdAt: '2025-01-01' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      updateName: vi.fn(),
      logout: vi.fn(),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows title, category, date, age, note and who recorded it', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'First steps' })).toBeInTheDocument();
    expect(screen.getByText('Motor')).toBeInTheDocument();
    expect(screen.getByText(/at 7 months/)).toBeInTheDocument();
    expect(screen.getByText('Three steps towards the cat.')).toBeInTheDocument();
    expect(await screen.findByText('Recorded by parent@example.com')).toBeInTheDocument();
  });

  it('falls back to a neutral label instead of a raw user id', async () => {
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([] as never);
    mockedMilestoneApi.fetchMilestone.mockResolvedValue(makeMilestone({ userId: 'someone-else' }));

    renderPage();

    expect(await screen.findByText('Recorded by Unknown')).toBeInTheDocument();
    expect(screen.queryByText(/someone-else/)).not.toBeInTheDocument();
  });

  it('renders straight from the timeline’s cached list while its own fetch is pending', () => {
    mockedMilestoneApi.fetchMilestone.mockReturnValue(new Promise(() => {}));
    queryClient.setQueryData(milestoneApi.milestonesQueryKey(HOUSEHOLD_ID, CHILD_ID), [
      makeMilestone({ title: 'Cached title' }),
    ]);

    renderPage();

    expect(screen.getByRole('heading', { name: 'Cached title' })).toBeInTheDocument();
  });

  it('opens the gallery from the cover and from each further photo', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.fetchMilestone.mockResolvedValue(
      makeMilestone({
        photos: [
          { id: 'p0', sortIndex: 0, mimeType: 'image/png' },
          { id: 'p1', sortIndex: 1, mimeType: 'image/png' },
        ],
      }),
    );

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'View photos of “First steps”' }));
    expect(await screen.findByText('1 of 2')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Photo 2 of “First steps”' }));
    expect(await screen.findByText('2 of 2')).toBeInTheDocument();
  });

  it('asks for confirmation, deletes and returns to the timeline', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.deleteMilestone.mockResolvedValue(undefined);

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete this milestone?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(LIST_PATH));
    expect(mockedMilestoneApi.deleteMilestone).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      MILESTONE_ID,
    );
  });

  it('stays on the page and surfaces a failed delete (M-15)', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.deleteMilestone.mockRejectedValue(new Error('offline'));

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete permanently' }));

    expect(
      await screen.findByText('The milestone could not be deleted. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'First steps' })).toBeInTheDocument();
  });

  describe('role-dependent actions', () => {
    it.each(['OWNER', 'CO_PARENT'] as const)(
      'offers a %s both Edit and Delete on a milestone recorded by someone else',
      async (role) => {
        givenRole(role);
        mockedMilestoneApi.fetchMilestone.mockResolvedValue(makeMilestone({ userId: FOREIGN_ID }));

        renderPage();

        expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute(
          'href',
          `${LIST_PATH}/${MILESTONE_ID}/edit`,
        );
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      },
    );

    it('lets a CAREGIVER edit their own milestone but never delete it', async () => {
      givenRole('CAREGIVER');

      renderPage();

      expect(await screen.findByRole('link', { name: 'Edit' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it("offers a CAREGIVER neither action on someone else's milestone", async () => {
      givenRole('CAREGIVER');
      mockedMilestoneApi.fetchMilestone.mockResolvedValue(makeMilestone({ userId: FOREIGN_ID }));

      renderPage();

      expect(await screen.findByRole('heading', { name: 'First steps' })).toBeInTheDocument();
      // Wait for the role to arrive before asserting absence.
      await waitFor(() => expect(mockedHouseholdApi.fetchHousehold).toHaveBeenCalled());
      expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('offers an OBSERVER no action at all, while the memory stays readable', async () => {
      givenRole('OBSERVER');

      renderPage();

      expect(await screen.findByRole('heading', { name: 'First steps' })).toBeInTheDocument();
      await waitFor(() => expect(mockedHouseholdApi.fetchHousehold).toHaveBeenCalled());
      expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });
  });
});
