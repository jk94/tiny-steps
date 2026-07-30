import { Link, Outlet } from 'react-router';

/**
 * Minimal app shell shared by every route. Kept intentionally bare in
 * Phase 0 — real navigation/branding follows once auth (Phase 1) exists.
 */
export function Layout() {
  return (
    <>
      <header>
        <nav>
          <Link to="/">Dashboard</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
