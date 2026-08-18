import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { DiaperBackfillCreate } from './DiaperBackfillCreate';
import * as diaperApi from '../api/diaper-api';
import * as useAuthModule from '../auth/useAuth';
import { queryClient } from '../lib/query-client';
import { chooseSelectOption } from '../test/chooseSelectOption';
import { stubPopupLayoutApis } from '../test/stubPopupLayoutApis';

vi.mock('../api/diaper-api');
vi.mock('../auth/useAuth');
vi.mock('../realtime/useHouseholdRoom');

// The diaper-type field is a Radix combobox — see the helper's doc comment.
stubPopupLayoutApis();

const mockedDiaperApi = vi.mocked(diaperApi);
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

const USER_ID = 'u1';

function mockAuthUser() {
  mockedUseAuth.mockReturnValue({
    user: { id: USER_ID, email: 'parent@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  });
}

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
  updatedAt: '2026-01-01T10:00:00.000Z',
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
    mockAuthUser();
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
    mockedDiaperApi.createDiaperEventOptimistic.mockResolvedValueOnce(created);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    renderBackfillCreate();

    await chooseSelectOption(user, 'Diaper type', 'Pee');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '2026-01-01T10:00' } });
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    expect(mockedDiaperApi.createDiaperEventOptimistic).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      CHILD_ID,
      USER_ID,
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
