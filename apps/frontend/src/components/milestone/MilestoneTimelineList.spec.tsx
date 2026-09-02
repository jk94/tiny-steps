import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { MilestoneTimelineList } from './MilestoneTimelineList';
import type { MilestoneSummary } from '../../api/milestone-api';
import * as milestoneApi from '../../api/milestone-api';
import * as householdApi from '../../api/household-api';
import { queryClient } from '../../lib/query-client';

vi.mock('../../api/milestone-api', async () => {
  const actual = await vi.importActual<typeof milestoneApi>('../../api/milestone-api');
  return { ...actual, deleteMilestone: vi.fn() };
});
vi.mock('../../api/household-api', async () => {
  const actual = await vi.importActual<typeof householdApi>('../../api/household-api');
  return { ...actual, listHouseholdMembers: vi.fn() };
});

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

function renderList(milestones: MilestoneSummary[], isLoading = false) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MilestoneTimelineList
          householdId={HOUSEHOLD_ID}
          childId={CHILD_ID}
          milestones={milestones}
          isLoading={isLoading}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MilestoneTimelineList (M-11)', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([
      { userId: 'u1', email: 'parent@example.com', role: 'OWNER', joinedAt: '2025-01-01' },
    ] as never);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders date, age, category and the stored title', async () => {
    renderList([makeMilestone()]);

    expect(screen.getByText('First steps')).toBeInTheDocument();
    expect(screen.getByText('at 7 months')).toBeInTheDocument();
    expect(screen.getByText('Motor')).toBeInTheDocument();
    expect(await screen.findByText('Recorded by parent@example.com')).toBeInTheDocument();
  });

  it('preserves the order the API returned rather than re-sorting', () => {
    renderList([
      makeMilestone({ id: 'newer', title: 'Newer', achievedAt: '2025-09-01T00:00:00.000Z' }),
      makeMilestone({ id: 'older', title: 'Older', achievedAt: '2025-03-01T00:00:00.000Z' }),
    ]);

    const titles = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(titles[0]).toContain('Newer');
    expect(titles[1]).toContain('Older');
  });

  it('falls back to a neutral label instead of a raw user id', async () => {
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([] as never);

    renderList([makeMilestone({ userId: 'someone-else' })]);

    expect(await screen.findByText('Recorded by Unknown')).toBeInTheDocument();
    expect(screen.queryByText(/someone-else/)).not.toBeInTheDocument();
  });

  it('shows the first three photos and a "+N" for the rest', () => {
    renderList([
      makeMilestone({
        photos: Array.from({ length: 5 }, (_unused, index) => ({
          id: `p${index}`,
          sortIndex: index,
          mimeType: 'image/png',
        })),
      }),
    ]);

    expect(screen.getAllByRole('presentation', { hidden: true })).toHaveLength(3);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('opens the full-size gallery from the thumbnail strip', async () => {
    const user = userEvent.setup();
    renderList([makeMilestone({ photos: [{ id: 'p0', sortIndex: 0, mimeType: 'image/png' }] })]);

    await user.click(screen.getByRole('button', { name: 'View photos of “First steps”' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
  });

  it('asks for confirmation before deleting and surfaces a failure (M-15)', async () => {
    const user = userEvent.setup();
    mockedMilestoneApi.deleteMilestone.mockRejectedValue(new Error('offline'));

    renderList([makeMilestone()]);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete this milestone?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));

    await waitFor(() => {
      expect(
        screen.getByText('The milestone could not be deleted. Please try again.'),
      ).toBeInTheDocument();
    });
  });

  it('offers an empty state with a call to action', () => {
    renderList([]);

    expect(screen.getByText('No milestones yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Record the first milestone' })).toHaveAttribute(
      'href',
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/milestones/new`,
    );
  });
});
