import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { GuestOnlyRoute } from './GuestOnlyRoute';
import * as useAuthModule from './useAuth';

vi.mock('./useAuth');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<GuestOnlyRoute />}>
          <Route path="/login" element={<p>Login form</p>} />
        </Route>
        <Route path="/" element={<p>Dashboard content</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GuestOnlyRoute', () => {
  it('renders a loading indicator without redirecting while loading', () => {
    mockedUseAuth.mockReturnValue({
      user: undefined,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      updateName: vi.fn(),
      logout: vi.fn(),
    });

    renderAt('/login');

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });

  it('redirects to / when already authenticated', () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: '1',
        email: 'parent@example.com',
        name: 'Bernd',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      updateName: vi.fn(),
      logout: vi.fn(),
    });

    renderAt('/login');

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });

  it('renders the nested route content when unauthenticated', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      updateName: vi.fn(),
      logout: vi.fn(),
    });

    renderAt('/login');

    expect(screen.getByText('Login form')).toBeInTheDocument();
  });
});
