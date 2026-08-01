import { Navigate, Outlet } from 'react-router';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useAuth } from './useAuth';

/**
 * Guards routes that only make sense for a logged-out visitor (login,
 * register). Mirrors `ProtectedRoute`'s structure but redirects the opposite
 * direction — an already-authenticated user visiting `/login` or `/register`
 * is sent back to `/` instead of being shown the form again.
 */
export function GuestOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
