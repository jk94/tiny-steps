import { Navigate, Outlet, useLocation } from 'react-router';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useAuth } from './useAuth';

/**
 * Guards nested routes behind authentication. Preserves the originally
 * requested path via router state (`state: { from: location }`) so a future
 * login form can redirect back after a successful login.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading, error } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!isAuthenticated) {
    // Redirect behaviour is unchanged either way (no distinct "error" UI
    // yet — that's a later sub-step), but a genuine backend/network failure
    // shouldn't be silently indistinguishable from "not logged in" in the
    // console at least.
    if (error) {
      console.error('Redirecting to /login after a failed auth check:', error);
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
