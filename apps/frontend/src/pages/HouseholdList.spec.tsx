import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { HouseholdList } from './HouseholdList';
import * as householdApi from '../api/household-api';
import { queryClient } from '../lib/query-client';

vi.mock('../api/household-api');

const mockedHouseholdApi = vi.mocked(householdApi);

function renderHouseholdList() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HouseholdList />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HouseholdList', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('renders the title and create-household link', () => {
    mockedHouseholdApi.listHouseholds.mockReturnValue(new Promise(() => {}));

    renderHouseholdList();

    expect(screen.getByRole('heading', { name: 'Households' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create household' })).toHaveAttribute(
      'href',
      '/households/new',
    );
  });

  it('shows the loading skeleton while the households query is in flight', () => {
    mockedHouseholdApi.listHouseholds.mockReturnValue(new Promise(() => {}));

    renderHouseholdList();

    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('shows the empty state when the user has no households', async () => {
    mockedHouseholdApi.listHouseholds.mockResolvedValueOnce([]);

    renderHouseholdList();

    expect(
      await screen.findByText("You aren't a member of any household yet."),
    ).toBeInTheDocument();
  });

  it('renders one entry per household, linked to its detail page, with a role badge', async () => {
    mockedHouseholdApi.listHouseholds.mockResolvedValueOnce([
      { id: 'h1', name: 'Team Müller', role: 'OWNER', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'h2', name: 'Team Schmidt', role: 'CO_PARENT', createdAt: '2026-01-02T00:00:00.000Z' },
    ]);

    renderHouseholdList();

    const ownerLink = await screen.findByRole('link', { name: 'Team Müller' });
    expect(ownerLink).toHaveAttribute('href', '/households/h1');
    expect(screen.getByText('Owner')).toBeInTheDocument();

    const coParentLink = screen.getByRole('link', { name: 'Team Schmidt' });
    expect(coParentLink).toHaveAttribute('href', '/households/h2');
    expect(screen.getByText('Member')).toBeInTheDocument();
  });
});
