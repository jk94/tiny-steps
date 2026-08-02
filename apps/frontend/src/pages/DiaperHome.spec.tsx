import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { DiaperHome } from './DiaperHome';
import * as childApi from '../api/child-api';
import * as diaperApi from '../api/diaper-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/child-api');
vi.mock('../api/diaper-api');

const mockedChildApi = vi.mocked(childApi);
const mockedDiaperApi = vi.mocked(diaperApi);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

const child: childApi.ChildSummary = {
  id: CHILD_ID,
  householdId: HOUSEHOLD_ID,
  name: 'Alex',
  birthDate: '2024-01-01T00:00:00.000Z',
  hasPhoto: false,
  createdAt: '2024-01-02T00:00:00.000Z',
};

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
});
