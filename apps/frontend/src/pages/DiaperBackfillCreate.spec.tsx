import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { DiaperBackfillCreate } from './DiaperBackfillCreate';
import * as diaperApi from '../api/diaper-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/diaper-api');
vi.mock('../realtime/useHouseholdRoom');

const mockedDiaperApi = vi.mocked(diaperApi);

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

const created: diaperApi.DiaperEventSummary = {
  id: 'e1',
  childId: CHILD_ID,
  userId: 'u1',
  type: 'DIAPER',
  diaperType: 'PEE',
  occurredAt: '2026-01-01T10:00:00.000Z',
  note: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

function renderBackfillCreate() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[`/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/diaper/new`]}
      >
        <Routes>
          <Route
            path="/households/:householdId/children/:childId/diaper/new"
            element={<DiaperBackfillCreate />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DiaperBackfillCreate', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('renders the DiaperEventForm in create mode', () => {
    renderBackfillCreate();

    expect(screen.getByRole('heading', { name: 'Add diaper entry' })).toBeInTheDocument();
    expect(screen.getByLabelText('Diaper type')).toBeEnabled();
  });

  it('creates the entry, invalidates the diaper-events query, and navigates back to diaper home', async () => {
    mockedDiaperApi.createDiaperEvent.mockResolvedValueOnce(created);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    renderBackfillCreate();

    await user.selectOptions(screen.getByLabelText('Diaper type'), 'Pee');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '2026-01-01T10:00' } });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(mockedDiaperApi.createDiaperEvent).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      expect.objectContaining({ diaperType: 'PEE' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'children', CHILD_ID, 'diaper-events'],
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/diaper`,
      { replace: true },
    );
  });
});
