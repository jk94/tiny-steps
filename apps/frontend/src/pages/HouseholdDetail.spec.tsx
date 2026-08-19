import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { HouseholdDetail } from './HouseholdDetail';
import * as householdApi from '../api/household-api';
import * as childApi from '../api/child-api';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';

vi.mock('../api/household-api');
vi.mock('../api/child-api');
vi.mock('../realtime/useHouseholdRoom');

const mockedHouseholdApi = vi.mocked(householdApi);
const mockedChildApi = vi.mocked(childApi);

function renderHouseholdDetail(householdId = 'h1') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/households/${householdId}`]}>
        <Routes>
          <Route path="/households/:householdId" element={<HouseholdDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HouseholdDetail', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedChildApi.listChildren.mockResolvedValue([]);
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the loading skeleton while the household query is in flight', () => {
    mockedHouseholdApi.fetchHousehold.mockReturnValue(new Promise(() => {}));

    renderHouseholdDetail();

    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('renders name, role, and createdAt once loaded', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValueOnce({
      id: 'h1',
      name: 'Team Müller',
      role: 'OWNER',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    renderHouseholdDetail();

    expect(await screen.findByRole('heading', { name: 'Team Müller' })).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('shows the OWNER-only invite generator for an OWNER', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValueOnce({
      id: 'h1',
      name: 'Team Müller',
      role: 'OWNER',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    renderHouseholdDetail();

    expect(await screen.findByRole('button', { name: 'Generate invite link' })).toBeInTheDocument();
  });

  it('hides the invite generator for a CO_PARENT', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValueOnce({
      id: 'h1',
      name: 'Team Müller',
      role: 'CO_PARENT',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    renderHouseholdDetail();

    await screen.findByRole('heading', { name: 'Team Müller' });
    expect(screen.queryByRole('button', { name: 'Generate invite link' })).not.toBeInTheDocument();
  });

  it('renders the not-found error message for a 404', async () => {
    mockedHouseholdApi.fetchHousehold.mockRejectedValueOnce(new ApiError(404, {}));

    renderHouseholdDetail();

    expect(
      await screen.findByText("This household wasn't found, or you aren't a member."),
    ).toBeInTheDocument();
  });
});
