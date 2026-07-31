import { createContext } from 'react';
import type { AuthUser } from '../api/auth-api';

export interface AuthContextValue {
  user: AuthUser | null | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Split into its own file (rather than living in AuthProvider.tsx) so that
// file only exports the `AuthProvider` component — keeps React Fast Refresh
// happy (see `react-refresh/only-export-components`).
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
