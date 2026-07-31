import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { ProtectedRoute } from './ProtectedRoute';
import * as useAuthModule from './useAuth';

vi.mock('./useAuth');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

function LoginWithFromState() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from;
  return <p>Login page{from ? ` (from ${from.pathname})` : ''}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<p>Dashboard content</p>} />
        </Route>
        <Route path="/login" element={<LoginWithFromState />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('renders a loading indicator without redirecting while loading', () => {
    mockedUseAuth.mockReturnValue({
      user: undefined,
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderAt('/dashboard');

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderAt('/dashboard');

    expect(screen.getByText('Login page (from /dashboard)')).toBeInTheDocument();
  });

  it('renders the nested route content when authenticated', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'parent@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderAt('/dashboard');

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });
});
