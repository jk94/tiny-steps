import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { DiaperHome } from './DiaperHome';
import * as childApi from '../api/child-api';
import * as diaperApi from '../api/diaper-api';
import * as householdApi from '../api/household-api';
import * as useAuthModule from '../auth/useAuth';
import type { HouseholdRole } from '../lib/householdPermissions';
import { queryClient } from '../lib/query-client';

vi.mock('../api/child-api');
vi.mock('../api/diaper-api');
vi.mock('../api/household-api');
vi.mock('../auth/useAuth');
vi.mock('../realtime/useHouseholdRoom');

const mockedChildApi = vi.mocked(childApi);
const mockedDiaperApi = vi.mocked(diaperApi);
const mockedHouseholdApi = vi.mocked(householdApi);
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
  sex: null,
  createdAt: '2024-01-02T00:00:00.000Z',
};

/** Resolves the household query `useHouseholdRole` reads the page's role from. */
function givenHouseholdRole(role: HouseholdRole = 'OWNER') {
  mockedHouseholdApi.fetchHousehold.mockResolvedValue({
    id: HOUSEHOLD_ID,
    name: 'Team Müller',
    role,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
}

function renderDiaperHome() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/diaper`]}>
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/diaper"
            element={<DiaperHome />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DiaperHome', () => {
  beforeEach(() => {
    queryClient.clear();
    mockAuthUser();
    givenHouseholdRole();
    mockedChildApi.fetchChild.mockResolvedValue(child);
    mockedDiaperApi.listDiaperEvents.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the child name in the heading', async () => {
    renderDiaperHome();

    expect(await screen.findByRole('heading', { name: 'Diaper — Alex' })).toBeInTheDocument();
  });

  it('renders DiaperQuickEntry', async () => {
    renderDiaperHome();

    expect(await screen.findByText('Quick entry')).toBeInTheDocument();
  });

  it('links to the backfill-create page', async () => {
    renderDiaperHome();

    const link = await screen.findByRole('link', { name: 'Add entry manually' });
    expect(link).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/diaper/new`,
    );
  });

  it('renders DiaperEventList', async () => {
    renderDiaperHome();

    expect(await screen.findByText('Recent diaper changes')).toBeInTheDocument();
  });

  describe('role-dependent create affordances', () => {
    it.each(['OWNER', 'CO_PARENT', 'CAREGIVER'] as const)(
      'offers quick entry and the backfill link to a %s',
      async (role) => {
        givenHouseholdRole(role);

        renderDiaperHome();

        expect(await screen.findByText('Quick entry')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Add entry manually' })).toBeInTheDocument();
      },
    );

    it('hides both from an OBSERVER while keeping the event list readable', async () => {
      givenHouseholdRole('OBSERVER');

      renderDiaperHome();

      expect(await screen.findByText('Recent diaper changes')).toBeInTheDocument();
      await vi.waitFor(() => expect(screen.queryByText('Quick entry')).not.toBeInTheDocument());
      expect(screen.queryByRole('link', { name: 'Add entry manually' })).not.toBeInTheDocument();
    });
  });
});
