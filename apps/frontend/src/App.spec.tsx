import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import App from './App';
import * as useAuthModule from './auth/useAuth';
import * as oidcApi from './api/oidc-api';
import * as householdApi from './api/household-api';
import * as inviteApi from './api/invite-api';
import { queryClient } from './lib/query-client';
import * as useRealtimeConnectionModule from './realtime/useRealtimeConnection';

vi.mock('./auth/useAuth');
vi.mock('./api/oidc-api');
vi.mock('./api/household-api');
vi.mock('./api/invite-api');
vi.mock('./realtime/useRealtimeConnection');
vi.mock('./realtime/useHouseholdRoom');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);
const mockedOidcApi = vi.mocked(oidcApi);
const mockedHouseholdApi = vi.mocked(householdApi);
const mockedInviteApi = vi.mocked(inviteApi);
const mockedUseRealtimeConnection = vi.mocked(useRealtimeConnectionModule.useRealtimeConnection);

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
    mockedHouseholdApi.listHouseholds.mockResolvedValue([]);
    mockedInviteApi.previewInvite.mockResolvedValue({ status: 'invalid' });
    mockedUseRealtimeConnection.mockReturnValue({ socket: null, isConnected: false });
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
      updateName: vi.fn(),
      logout: vi.fn(),
    });

    renderAppAt('/');

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('shows the household list at / when authenticated', () => {
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

    renderAppAt('/');

    expect(screen.getByRole('heading', { name: 'Households' })).toBeInTheDocument();
  });

  it('redirects an authenticated user visiting /login to the household list (GuestOnlyRoute)', () => {
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

    renderAppAt('/login');

    expect(screen.getByRole('heading', { name: 'Households' })).toBeInTheDocument();
  });

  it('redirects an authenticated user visiting /register to the household list (GuestOnlyRoute)', () => {
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

    renderAppAt('/register');

    expect(screen.getByRole('heading', { name: 'Households' })).toBeInTheDocument();
  });

  it('renders the households list under ProtectedRoute for an authenticated user', () => {
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

    renderAppAt('/households');

    expect(screen.getByRole('heading', { name: 'Households' })).toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor from /households to /login (ProtectedRoute)', () => {
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

    renderAppAt('/households');

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('renders the invite-accept page for an unauthenticated visitor without redirecting', () => {
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

    renderAppAt('/invites/a-token');

    expect(screen.getByRole('heading', { name: 'Invitation' })).toBeInTheDocument();
  });

  it('renders the invite-accept page for an authenticated visitor without redirecting', () => {
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

    renderAppAt('/invites/a-token');

    expect(screen.getByRole('heading', { name: 'Invitation' })).toBeInTheDocument();
  });
});
