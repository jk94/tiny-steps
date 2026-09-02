import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { MilestoneCatalogView } from './MilestoneCatalogView';
import type { MilestoneSummary } from '../../api/milestone-api';
import { MILESTONE_TEMPLATES } from '../../lib/milestoneCatalog';

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

/** Renders the current location so navigation targets can be asserted. */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderCatalog(milestones: MilestoneSummary[]) {
  return render(
    <MemoryRouter initialEntries={[BASE_PATH]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <MilestoneCatalogView
                householdId={HOUSEHOLD_ID}
                childId={CHILD_ID}
                milestones={milestones}
              />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MilestoneCatalogView (M-12)', () => {
  it('lists every catalog template, grouped by typical age', () => {
    renderCatalog([]);

    expect(screen.getAllByRole('listitem')).toHaveLength(MILESTONE_TEMPLATES.length);
    expect(screen.getByText('0–6 months')).toBeInTheDocument();
    expect(screen.getByText('24–36 months')).toBeInTheDocument();
  });

  it('phrases the age span as a spread, never as a target (M-3)', () => {
    renderCatalog([]);

    expect(screen.getByText('usually between 11 and 16 months')).toBeInTheDocument();
    // Nothing anywhere claims a milestone is late or missing.
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/late/i)).not.toBeInTheDocument();
  });

  it('marks an already-recorded template and opens the existing entry (M-5)', async () => {
    const user = userEvent.setup();
    renderCatalog([makeMilestone({ id: 'existing', templateKey: 'FIRST_STEPS' })]);

    expect(screen.getByText('Recorded')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open “First steps”' }));

    // Opening the existing entry, not running into the uniqueness conflict.
    expect(screen.getByTestId('location')).toHaveTextContent(`${BASE_PATH}/existing/edit`);
  });

  it('prefills the create form from an unrecorded template', async () => {
    const user = userEvent.setup();
    renderCatalog([]);

    await user.click(screen.getByRole('button', { name: 'Record “First steps”' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `${BASE_PATH}/new?templateKey=FIRST_STEPS`,
    );
  });

  it('does not mark a template as recorded because of an unrelated free entry', () => {
    renderCatalog([makeMilestone({ templateKey: null, title: 'First trip by train' })]);

    expect(screen.queryByText('Recorded')).not.toBeInTheDocument();
  });
});
