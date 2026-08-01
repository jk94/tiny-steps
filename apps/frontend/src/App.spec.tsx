import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import App from './App';
import * as useAuthModule from './auth/useAuth';
import * as oidcApi from './api/oidc-api';
import { queryClient } from './lib/query-client';

vi.mock('./auth/useAuth');
vi.mock('./api/oidc-api');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);
const mockedOidcApi = vi.mocked(oidcApi);

function renderAppAt(entry: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedOidcApi.fetchOidcProviders.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the Login page at / when unauthenticated (ProtectedRoute redirect)', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderAppAt('/');

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('shows the Dashboard placeholder at / when authenticated', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'parent@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderAppAt('/');

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('redirects an authenticated user visiting /login to the Dashboard (GuestOnlyRoute)', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'parent@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderAppAt('/login');

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('redirects an authenticated user visiting /register to the Dashboard (GuestOnlyRoute)', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'parent@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderAppAt('/register');

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
