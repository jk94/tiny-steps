import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { HouseholdCreate } from './HouseholdCreate';
import * as householdApi from '../api/household-api';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';

vi.mock('../api/household-api');

const mockedHouseholdApi = vi.mocked(householdApi);

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderHouseholdCreate() {
  return render(
    <MemoryRouter>
      <HouseholdCreate />
    </MemoryRouter>,
  );
}

describe('HouseholdCreate', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('renders the title, name field, and submit button', () => {
    renderHouseholdCreate();

    expect(screen.getByRole('heading', { name: 'Create household' })).toBeInTheDocument();
    expect(screen.getByLabelText('Household name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('blocks submission and shows a validation error for an empty name', async () => {
    const user = userEvent.setup();
    renderHouseholdCreate();

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText('Please enter a name for the household.')).toBeInTheDocument();
    expect(mockedHouseholdApi.createHousehold).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a validation error for a too-long name', async () => {
    const user = userEvent.setup();
    renderHouseholdCreate();

    // `fireEvent.change` bypasses the input's `maxLength={120}` attribute
    // (which `user.type()` respects by truncating), so this actually
    // exercises the JS-level length check rather than being unreachable.
    fireEvent.change(screen.getByLabelText('Household name'), {
      target: { value: 'a'.repeat(121) },
    });
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText('The name must be at most 120 characters long.')).toBeInTheDocument();
    expect(mockedHouseholdApi.createHousehold).not.toHaveBeenCalled();
  });

  it('creates the household, invalidates the households query, and navigates to its detail page on success', async () => {
    mockedHouseholdApi.createHousehold.mockResolvedValueOnce({
      id: 'h1',
      name: 'Team Müller',
      role: 'OWNER',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();
    renderHouseholdCreate();

    await user.type(screen.getByLabelText('Household name'), 'Team Müller');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(mockedHouseholdApi.createHousehold).toHaveBeenCalledWith('Team Müller');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['households'] });
    expect(mockNavigate).toHaveBeenCalledWith('/households/h1', { replace: true });
  });

  it('shows a mapped error message and re-enables the button on failure', async () => {
    mockedHouseholdApi.createHousehold.mockRejectedValueOnce(new ApiError(500, {}));
    const user = userEvent.setup();
    renderHouseholdCreate();

    await user.type(screen.getByLabelText('Household name'), 'Team Müller');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again later.',
    );
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });
});
