import { QueryClient } from '@tanstack/react-query';

/**
 * Module-level singleton, created once at the true app root and never
 * remounted — the app-root-`useState` pattern for `QueryClient` exists to
 * avoid recreating it across suspense/SSR remounts, which doesn't apply
 * here (client-only SPA).
 *
 * `retry: false` for both queries and mutations: `apiFetch` already
 * performs the one legitimate retry (401 -> refresh -> retry once).
 * TanStack Query's default exponential-backoff retries would be redundant
 * for auth failures and actively harmful for mutations — retrying a
 * `POST /login` or a future `POST /children` risks duplicate side effects.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});
