import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useHouseholdRole } from './useHouseholdRole';
import * as householdApi from '../api/household-api';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';

vi.mock('../api/household-api');

const mockedHouseholdApi = vi.mocked(householdApi);

const HOUSEHOLD = {
  id: 'h1',
  name: 'Team Müller',
  role: 'CAREGIVER' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useHouseholdRole', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('resolves the role once the household loads', async () => {
    mockedHouseholdApi.fetchHousehold.mockResolvedValue(HOUSEHOLD);

    const { result } = renderHook(() => useHouseholdRole('h1'), { wrapper });

    await waitFor(() => expect(result.current.role).toBe('CAREGIVER'));
    expect(result.current.household).toEqual(HOUSEHOLD);
    expect(result.current.isLoading).toBe(false);
  });

  it('reports no role while the request is still in flight', () => {
    mockedHouseholdApi.fetchHousehold.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useHouseholdRole('h1'), { wrapper });

    expect(result.current.role).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it('reports no role when the request fails, rather than guessing one', async () => {
    mockedHouseholdApi.fetchHousehold.mockRejectedValue(new ApiError(403, {}));

    const { result } = renderHook(() => useHouseholdRole('h1'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.role).toBeUndefined();
  });

  it('does not fetch without a household id', () => {
    const { result } = renderHook(() => useHouseholdRole(undefined), { wrapper });

    expect(mockedHouseholdApi.fetchHousehold).not.toHaveBeenCalled();
    expect(result.current.role).toBeUndefined();
  });

  it('reads the cache entry `HouseholdDetail` already filled, without a loading pass', () => {
    // `HouseholdDetail` writes this exact key; serving it on the very first
    // render is what proves the two share one cache entry rather than each
    // fetching the household separately.
    mockedHouseholdApi.fetchHousehold.mockResolvedValue(HOUSEHOLD);
    queryClient.setQueryData(['households', 'h1'], HOUSEHOLD);

    const { result } = renderHook(() => useHouseholdRole('h1'), { wrapper });

    expect(result.current.role).toBe('CAREGIVER');
    expect(result.current.isLoading).toBe(false);
  });
});
