import { Link, Outlet } from 'react-router';
import { useAuth } from '../auth/useAuth';

/**
 * Minimal app shell shared by every route. Kept intentionally bare — real
 * navigation/branding follows once the actual login/register UI exists.
 *
 * The email + logout button here is a deliberate exception to "no UI this
 * sub-step": it's the manual, end-to-end proof that cookies/CSRF/protected
 * routing/logout actually work before the real login form exists.
 */
export function Layout() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  return (
    <>
      <header>
        <nav>
          <Link to="/">Dashboard</Link>
        </nav>
        {!isLoading && isAuthenticated && user && (
          <div>
            <span>{user.email}</span>
            <button type="button" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
