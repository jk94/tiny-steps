import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { MilestoneSummaryCard } from './MilestoneSummaryCard';
import type { MilestoneSummary } from '../../api/milestone-api';
import * as milestoneApi from '../../api/milestone-api';
import * as householdApi from '../../api/household-api';
import type { HouseholdRole } from '../../lib/householdPermissions';
import { queryClient } from '../../lib/query-client';

vi.mock('../../api/milestone-api', async () => {
  const actual = await vi.importActual<typeof milestoneApi>('../../api/milestone-api');
  return { ...actual, listMilestones: vi.fn() };
});
vi.mock('../../api/household-api');

const mockedMilestoneApi = vi.mocked(milestoneApi);
const mockedHouseholdApi = vi.mocked(householdApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

function makeMilestone(overrides: Partial<MilestoneSummary> = {}): MilestoneSummary {
  return {
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
    ...overrides,
  };
}

/** Resolves the household query `useHouseholdRole` reads the card's role from. */
function givenHouseholdRole(role: HouseholdRole = 'OWNER') {
  mockedHouseholdApi.fetchHousehold.mockResolvedValue({
    id: HOUSEHOLD_ID,
    name: 'Team Müller',
    role,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
}

function renderCard() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MilestoneSummaryCard householdId={HOUSEHOLD_ID} childId={CHILD_ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MilestoneSummaryCard (M-13)', () => {
  beforeEach(() => {
    queryClient.clear();
    givenHouseholdRole();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows the most recently recorded milestone with its age and category', async () => {
    // The API answers newest-first, so the first element is the latest.
    mockedMilestoneApi.listMilestones.mockResolvedValue([
      makeMilestone(),
      makeMilestone({ id: 'm0', title: 'First smile', achievedAt: '2025-03-01T00:00:00.000Z' }),
    ]);

    renderCard();

    expect(await screen.findByText('First steps')).toBeInTheDocument();
    expect(screen.getByText('at 7 months')).toBeInTheDocument();
    expect(screen.getByText('Motor')).toBeInTheDocument();
    expect(screen.queryByText('First smile')).not.toBeInTheDocument();
  });

  it('renders the stored title, not a re-translation of the template key', async () => {
    // A record keeps the label it was created with, even if the catalog's
    // translation later changes.
    mockedMilestoneApi.listMilestones.mockResolvedValue([
      makeMilestone({ templateKey: 'FIRST_STEPS', title: 'Erste Schritte' }),
    ]);

    renderCard();

    expect(await screen.findByText('Erste Schritte')).toBeInTheDocument();
  });

  it('offers an empty state with a call to action when nothing is recorded yet', async () => {
    mockedMilestoneApi.listMilestones.mockResolvedValue([]);

    renderCard();

    expect(await screen.findByText('No milestone recorded yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Record a milestone' })).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/milestones/new`,
    );
  });

  it('keeps the empty-state statement but drops the call to action for an OBSERVER', async () => {
    givenHouseholdRole('OBSERVER');
    mockedMilestoneApi.listMilestones.mockResolvedValue([]);

    renderCard();

    expect(await screen.findByText('No milestone recorded yet.')).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Record a milestone' })).not.toBeInTheDocument(),
    );
  });

  it('renders nothing at all when the query fails', async () => {
    // The child overview must not turn into an error page because one optional
    // card could not load.
    mockedMilestoneApi.listMilestones.mockRejectedValue(new Error('offline'));

    const { container } = renderCard();

    await vi.waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
