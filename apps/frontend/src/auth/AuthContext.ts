import { createContext } from 'react';
import type { AuthUser } from '../api/auth-api';

export interface AuthContextValue {
  user: AuthUser | null | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Populated only when the underlying `/auth/me` check failed for a reason
   * OTHER than "no session" (i.e. `fetchMeOrNull` rethrew instead of
   * resolving to `null`) — a genuine backend/network failure, not an
   * ordinary logged-out visitor. `null`/`undefined` in every other case,
   * including the ordinary logged-out case. Not yet consumed by any UI
   * (`ProtectedRoute` still redirects to `/login` regardless); exposed here
   * so a future error-aware UI can distinguish "please log in" from "the
   * backend is down" instead of the two looking identical to the user.
   */
  error: unknown;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Split into its own file (rather than living in AuthProvider.tsx) so that
// file only exports the `AuthProvider` component — keeps React Fast Refresh
// happy (see `react-refresh/only-export-components`).
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
