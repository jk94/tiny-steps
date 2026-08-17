import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { HouseholdSwitcher } from './HouseholdSwitcher';
import * as householdApi from '../api/household-api';
import { queryClient } from '../lib/query-client';
import { chooseSelectOption } from '../test/chooseSelectOption';
import { stubPopupLayoutApis } from '../test/stubPopupLayoutApis';

vi.mock('../api/household-api');

// The household switcher is a Radix combobox — see the helper's doc comment.
stubPopupLayoutApis();

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

  it('shows the placeholder and one option per household', async () => {
    mockedHouseholdApi.listHouseholds.mockResolvedValueOnce([
      { id: 'h1', name: 'Team Müller', role: 'OWNER', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'h2', name: 'Team Schmidt', role: 'CO_PARENT', createdAt: '2026-01-02T00:00:00.000Z' },
    ]);
    const user = userEvent.setup();

    renderHouseholdSwitcher();

    // Nothing is selected, so the trigger shows the placeholder rather than a
    // household name (there is no "current household" concept in the app).
    const select = await screen.findByRole('combobox', { name: 'Switch household' });
    expect(select).toHaveTextContent('Choose a household…');

    await user.click(select);

    expect(await screen.findByRole('option', { name: 'Team Müller' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Team Schmidt' })).toBeInTheDocument();
    // The placeholder is not itself a choosable option any more.
    expect(screen.queryByRole('option', { name: 'Choose a household…' })).not.toBeInTheDocument();
  });

  it('navigates to the selected household on change', async () => {
    mockedHouseholdApi.listHouseholds.mockResolvedValueOnce([
      { id: 'h1', name: 'Team Müller', role: 'OWNER', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    const user = userEvent.setup();

    renderHouseholdSwitcher();

    await chooseSelectOption(user, 'Switch household', 'Team Müller');

    expect(mockNavigate).toHaveBeenCalledWith('/households/h1');
  });

  it('resets to the placeholder after navigating, so it stays a one-shot trigger', async () => {
    mockedHouseholdApi.listHouseholds.mockResolvedValueOnce([
      { id: 'h1', name: 'Team Müller', role: 'OWNER', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    const user = userEvent.setup();

    renderHouseholdSwitcher();

    await chooseSelectOption(user, 'Switch household', 'Team Müller');

    const select = screen.getByRole('combobox', { name: 'Switch household' });
    expect(select).toHaveTextContent('Choose a household…');
    expect(select).not.toHaveTextContent('Team Müller');
  });
});
