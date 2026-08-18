import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';
import { ApiError } from '../api/http-client';
import * as authApi from '../api/auth-api';
// AuthProvider writes optimistic auth updates (login/register/logout) via
// this module-level singleton rather than the context-provided QueryClient
// (see lib/query-client.ts), so tests must render against the same
// singleton for those writes to be observable through `useAuth()`.
import { queryClient } from '../lib/query-client';

vi.mock('../api/auth-api');

const mockedAuthApi = vi.mocked(authApi);

const testUser = {
  id: '1',
  email: 'parent@example.com',
  name: 'Bernd',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderUseAuth() {
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }
  return renderHook(() => useAuth(), { wrapper });
}

describe('AuthProvider / useAuth', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('calls fetchMe exactly once on mount and resolves an authenticated user', async () => {
    mockedAuthApi.fetchMe.mockResolvedValueOnce(testUser);

    const { result } = renderUseAuth();

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(testUser);
    expect(mockedAuthApi.fetchMe).toHaveBeenCalledTimes(1);
  });

  it('resolves to user: null on a rejected/401 fetchMe, without throwing', async () => {
    mockedAuthApi.fetchMe.mockRejectedValueOnce(new ApiError(401, { message: 'Unauthorized' }));

    const { result } = renderUseAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeFalsy();
  });

  it('exposes a genuine (non-401) fetchMe failure via error, while still reporting logged-out state', async () => {
    const backendFailure = new ApiError(500, { message: 'Internal Server Error' });
    mockedAuthApi.fetchMe.mockRejectedValueOnce(backendFailure);

    const { result } = renderUseAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // A genuine backend/network failure must look the same as "not logged
    // in" from user/isAuthenticated's perspective (ProtectedRoute doesn't
    // branch on error yet) ...
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    // ... but must be distinguishable at the data layer via `error`, unlike
    // the ordinary 401/no-session case above.
    expect(result.current.error).toBe(backendFailure);
  });

  it('login() success updates state without a second /me call', async () => {
    mockedAuthApi.fetchMe.mockResolvedValueOnce(null as never);
    mockedAuthApi.fetchMe.mockRejectedValue(new ApiError(401, { message: 'Unauthorized' }));
    mockedAuthApi.login.mockResolvedValueOnce({ user: testUser });

    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);

    await result.current.login('parent@example.com', 'password123');

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user).toEqual(testUser);
    expect(mockedAuthApi.fetchMe).toHaveBeenCalledTimes(1);
  });

  it('login() failure rejects and leaves state unauthenticated', async () => {
    mockedAuthApi.fetchMe.mockRejectedValue(new ApiError(401, { message: 'Unauthorized' }));
    mockedAuthApi.login.mockRejectedValueOnce(
      new ApiError(401, { message: 'Invalid credentials' }),
    );

    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.login('parent@example.com', 'wrong')).rejects.toThrow(ApiError);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('register() failure rejects and leaves state unauthenticated', async () => {
    mockedAuthApi.fetchMe.mockRejectedValue(new ApiError(401, { message: 'Unauthorized' }));
    mockedAuthApi.register.mockRejectedValueOnce(new ApiError(409, { message: 'Email in use' }));

    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.register('parent@example.com', 'password123', 'Bernd'),
    ).rejects.toThrow(ApiError);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('updateName() success writes the returned user into the cache without a second /me call', async () => {
    const namelessUser = { ...testUser, name: null };
    mockedAuthApi.fetchMe.mockResolvedValueOnce(namelessUser);
    mockedAuthApi.updateMe.mockResolvedValueOnce(testUser);

    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.user).toEqual(namelessUser));

    await result.current.updateName('Bernd');

    await waitFor(() => expect(result.current.user).toEqual(testUser));
    expect(mockedAuthApi.updateMe).toHaveBeenCalledWith('Bernd');
    expect(mockedAuthApi.fetchMe).toHaveBeenCalledTimes(1);
  });

  it('updateName() failure rejects and leaves the cached user untouched', async () => {
    const namelessUser = { ...testUser, name: null };
    mockedAuthApi.fetchMe.mockResolvedValue(namelessUser);
    mockedAuthApi.updateMe.mockRejectedValueOnce(new ApiError(500, { message: 'Boom' }));

    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.user).toEqual(namelessUser));

    await expect(result.current.updateName('Bernd')).rejects.toThrow(ApiError);
    expect(result.current.user).toEqual(namelessUser);
  });

  it('logout() clears user state and wipes the query cache', async () => {
    mockedAuthApi.fetchMe
      .mockResolvedValueOnce(testUser) // initial mount
      // `queryClient.clear()` after logout removes the cache entry, which
      // triggers an automatic refetch of the still-mounted `/me` query — in
      // a real logout the cookies are gone server-side, so this mirrors
      // that with a 401.
      .mockRejectedValue(new ApiError(401, { message: 'Unauthorized' }));
    mockedAuthApi.logout.mockResolvedValueOnce(undefined);

    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    // Populate an unrelated cache entry to verify queryClient.clear() really
    // wipes the whole cache, not just the auth/me key.
    queryClient.setQueryData(['some', 'other', 'query'], { cached: true });

    await result.current.logout();

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(result.current.user).toBeNull();
    expect(queryClient.getQueryData(['some', 'other', 'query'])).toBeUndefined();
  });

  it('throws when useAuth is called outside an AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider',
    );
  });
});
