import { Navigate, Outlet, useLocation } from 'react-router';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useAuth } from './useAuth';

/**
 * Guards nested routes behind authentication. Preserves the originally
 * requested path via router state (`state: { from: location }`) so a future
 * login form can redirect back after a successful login.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
