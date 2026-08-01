import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ChildCreate } from './ChildCreate';
import * as householdApi from '../api/household-api';
import * as childApi from '../api/child-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/household-api');
// Partial mock: `ChildForm` imports `buildChildFormData` from this same
// module, so a full auto-mock would silently turn it into a `vi.fn()`
// returning `undefined` and break `onSubmit`'s FormData payload — keep the
// real implementation, only mock the network calls.
vi.mock('../api/child-api', async () => {
  const actual = await vi.importActual<typeof import('../api/child-api')>('../api/child-api');
  return { ...actual, createChild: vi.fn() };
});

const mockedHouseholdApi = vi.mocked(householdApi);
const mockedChildApi = vi.mocked(childApi);

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderChildCreate() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/households/h1/children/new']}>
        <Routes>
          <Route path="/households/:householdId/children/new" element={<ChildCreate />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ChildCreate', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('renders the ChildForm for an OWNER', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValueOnce({
      id: 'h1',
      name: 'Team Müller',
      role: 'OWNER',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    renderChildCreate();

    expect(
      await screen.findByRole('heading', { name: 'Create child profile' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('shows a forbidden message for a CO_PARENT instead of the form', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValueOnce({
      id: 'h1',
      name: 'Team Müller',
      role: 'CO_PARENT',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    renderChildCreate();

    expect(
      await screen.findByText('Only the household owner can perform this action.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('creates the child, invalidates the children query, and navigates on success', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValueOnce({
      id: 'h1',
      name: 'Team Müller',
      role: 'OWNER',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    mockedChildApi.createChild.mockResolvedValueOnce({
      id: 'c1',
      householdId: 'h1',
      name: 'Alex',
      birthDate: '2020-01-01',
      hasPhoto: false,
      createdAt: '2020-01-01T00:00:00.000Z',
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    renderChildCreate();

    await screen.findByLabelText('Name');
    await user.type(screen.getByLabelText('Name'), 'Alex');
    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: '2020-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(mockedChildApi.createChild).toHaveBeenCalledWith('h1', expect.any(FormData));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['households', 'h1', 'children'] });
    expect(mockNavigate).toHaveBeenCalledWith('/households/h1', { replace: true });
  });
});
