import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { MilestoneTimelineList } from './MilestoneTimelineList';
import type { MilestoneSummary } from '../../api/milestone-api';
import type { HouseholdRole } from '../../lib/householdPermissions';
import { queryClient } from '../../lib/query-client';

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/milestones`;

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

function photos(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `p${index}`,
    sortIndex: index,
    mimeType: 'image/png',
  }));
}

function renderList(
  milestones: MilestoneSummary[],
  { isLoading = false, role = 'OWNER' as HouseholdRole | undefined } = {},
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MilestoneTimelineList
          householdId={HOUSEHOLD_ID}
          childId={CHILD_ID}
          milestones={milestones}
          isLoading={isLoading}
          role={role}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MilestoneTimelineList (M-11)', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('renders the stored title, date, age and category on each tile', () => {
    renderList([makeMilestone()]);

    expect(screen.getByText('First steps')).toBeInTheDocument();
    expect(screen.getByText(/at 7 months/)).toBeInTheDocument();
    expect(screen.getByText('Motor')).toBeInTheDocument();
  });

  it('keeps the note off the tile — it belongs to the detail screen', () => {
    renderList([makeMilestone({ note: 'At grandma’s, holding the sofa' })]);

    expect(screen.queryByText('At grandma’s, holding the sofa')).not.toBeInTheDocument();
  });

  it('makes the whole tile a link to the milestone’s detail screen', () => {
    renderList([makeMilestone({ id: 'm42' })]);

    expect(screen.getByRole('link', { name: /First steps/ })).toHaveAttribute(
      'href',
      `${BASE_PATH}/m42`,
    );
  });

  it('offers no edit or delete action on the tile itself', () => {
    renderList([makeMilestone()]);

    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
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

  it('uses the first photo as the cover — and only that one', () => {
    renderList([makeMilestone({ photos: photos(3) })]);

    const tile = screen.getByRole('link', { name: /First steps/ });
    // Decorative (`alt=""`), so the cover has the `presentation` role.
    const images = within(tile).getAllByRole('presentation');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', expect.stringContaining('/photos/p0'));
  });

  it('counts the photos on the cover when there is more than one', () => {
    renderList([makeMilestone({ photos: photos(3) })]);

    expect(screen.getByText('3 photos')).toBeInTheDocument();
  });

  it('shows no photo count for a single photo', () => {
    renderList([makeMilestone({ photos: photos(1) })]);

    expect(screen.queryByText(/photos?$/)).not.toBeInTheDocument();
  });

  it('falls back to the category illustration when there is no photo', () => {
    renderList([makeMilestone({ photos: [] })]);

    const tile = screen.getByRole('link', { name: /First steps/ });
    expect(within(tile).queryByRole('presentation')).not.toBeInTheDocument();
    expect(tile.querySelector('svg[viewBox="0 0 120 120"]')).not.toBeNull();
  });

  it('offers an empty state with a call to action', () => {
    renderList([]);

    expect(screen.getByText('No milestones yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Record the first milestone' })).toHaveAttribute(
      'href',
      `${BASE_PATH}/new`,
    );
  });

  it('keeps the empty statement but drops the call to action for an OBSERVER', () => {
    renderList([], { role: 'OBSERVER' });

    expect(screen.getByText('No milestones yet')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Record the first milestone' }),
    ).not.toBeInTheDocument();
  });

  it('shows tile-shaped skeletons while loading', () => {
    renderList([], { isLoading: true });

    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('No milestones yet')).not.toBeInTheDocument();
  });
});
