import { useCallback, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError } from '../api/http-client';
import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../api/auth-api';
import type { AuthUser } from '../api/auth-api';
import { queryClient } from '../lib/query-client';
import { AuthContext, type AuthContextValue } from './AuthContext';

const AUTH_ME_QUERY_KEY = ['auth', 'me'] as const;

/**
 * A fresh unauthenticated visitor (or a request whose `apiFetch`-internal
 * refresh attempt also failed) should resolve `/auth/me` to `null` data
 * rather than an error state. This lets `ProtectedRoute` fail closed purely
 * off `isAuthenticated`, without a separate error branch to handle.
 */
async function fetchMeOrNull(): Promise<AuthUser | null> {
  try {
    return await fetchMe();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const meQuery = useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: fetchMeOrNull,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginRequest(email, password),
    onSuccess: (result) => {
      // Avoids a redundant `/me` round-trip immediately after login.
      queryClient.setQueryData(AUTH_ME_QUERY_KEY, result.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      registerRequest(email, password),
    onSuccess: (result) => {
      queryClient.setQueryData(AUTH_ME_QUERY_KEY, result.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      queryClient.setQueryData(AUTH_ME_QUERY_KEY, null);
      // Wipes any other cached query data too — matters for a shared-device
      // account switch, even though nothing else populates the cache yet.
      queryClient.clear();
    },
  });

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMutation.mutateAsync({ email, password });
    },
    [loginMutation],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      await registerMutation.mutateAsync({ email, password });
    },
    [registerMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const user = meQuery.isLoading ? undefined : (meQuery.data ?? null);
  const isAuthenticated = !!meQuery.data;
  const isLoading = meQuery.isLoading;
  // Only set when `fetchMeOrNull` rethrew a non-401 failure — the ordinary
  // "no session" 401 case resolves to `null` data with no query error.
  const error = meQuery.error;

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated, isLoading, error, login, register, logout }),
    [user, isAuthenticated, isLoading, error, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
