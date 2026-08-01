import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { HouseholdSwitcher } from './HouseholdSwitcher';
import * as householdApi from '../api/household-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/household-api');

const mockedHouseholdApi = vi.mocked(householdApi);

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderHouseholdSwitcher() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HouseholdSwitcher />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HouseholdSwitcher', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('renders nothing while the households query is loading', () => {
    mockedHouseholdApi.listHouseholds.mockReturnValue(new Promise(() => {}));

    const { container } = renderHouseholdSwitcher();

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the user has zero households', async () => {
    mockedHouseholdApi.listHouseholds.mockResolvedValueOnce([]);

    const { container } = renderHouseholdSwitcher();

    await waitFor(() => expect(mockedHouseholdApi.listHouseholds).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a placeholder option plus one option per household', async () => {
    mockedHouseholdApi.listHouseholds.mockResolvedValueOnce([
      { id: 'h1', name: 'Team Müller', role: 'OWNER', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'h2', name: 'Team Schmidt', role: 'CO_PARENT', createdAt: '2026-01-02T00:00:00.000Z' },
    ]);

    renderHouseholdSwitcher();

    const select = await screen.findByRole('combobox', { name: 'Switch household' });
    expect(screen.getByRole('option', { name: 'Choose a household…' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Team Müller' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Team Schmidt' })).toBeInTheDocument();
    expect(select).toHaveValue('');
  });

  it('navigates to the selected household on change', async () => {
    mockedHouseholdApi.listHouseholds.mockResolvedValueOnce([
      { id: 'h1', name: 'Team Müller', role: 'OWNER', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    const user = userEvent.setup();

    renderHouseholdSwitcher();

    const select = await screen.findByRole('combobox', { name: 'Switch household' });
    await user.selectOptions(select, 'Team Müller');

    expect(mockNavigate).toHaveBeenCalledWith('/households/h1');
  });
});
