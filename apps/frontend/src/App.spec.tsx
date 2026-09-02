import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import App from './App';
import * as useAuthModule from './auth/useAuth';
import * as oidcApi from './api/oidc-api';
import * as childApi from './api/child-api';
import * as growthApi from './api/growth-api';
import * as milestoneApi from './api/milestone-api';
import * as householdApi from './api/household-api';
import * as inviteApi from './api/invite-api';
import { queryClient } from './lib/query-client';
import * as useRealtimeConnectionModule from './realtime/useRealtimeConnection';

vi.mock('./auth/useAuth');
vi.mock('./api/oidc-api');
vi.mock('./api/child-api');
vi.mock('./api/growth-api');
// Partial mock: the query-key factories must stay real, since an
// auto-mocked one returns `undefined` and React Query rejects that.
vi.mock('./api/milestone-api', async () => {
  const actual = await vi.importActual<typeof milestoneApi>('./api/milestone-api');
  return { ...actual, listMilestones: vi.fn() };
});
vi.mock('./api/household-api');
vi.mock('./api/invite-api');
vi.mock('./realtime/useRealtimeConnection');
vi.mock('./realtime/useHouseholdRoom');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);
const mockedOidcApi = vi.mocked(oidcApi);
const mockedChildApi = vi.mocked(childApi);
const mockedGrowthApi = vi.mocked(growthApi);
const mockedMilestoneApi = vi.mocked(milestoneApi);
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

  it('renders the growth page at the child growth route', async () => {
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
    mockedChildApi.fetchChild.mockResolvedValue({
      id: 'c1',
      householdId: 'h1',
      name: 'Mia',
      birthDate: '2025-01-01T00:00:00.000Z',
      hasPhoto: false,
      sex: 'FEMALE',
      createdAt: '2025-01-02T00:00:00.000Z',
    });
    mockedGrowthApi.listGrowthMeasurements.mockResolvedValue([]);
    mockedGrowthApi.fetchGrowthReference.mockResolvedValue({
      indicator: 'WEIGHT_FOR_AGE',
      sex: null,
      available: false,
      reason: 'CHILD_SEX_NOT_SET',
    });
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([]);

    renderAppAt('/households/h1/children/c1/growth');

    expect(await screen.findByRole('heading', { name: 'Growth — Mia' })).toBeInTheDocument();
  });

  it('renders the milestone page at the child milestones route', async () => {
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
    mockedChildApi.fetchChild.mockResolvedValue({
      id: 'c1',
      householdId: 'h1',
      name: 'Mia',
      birthDate: '2025-01-01T00:00:00.000Z',
      hasPhoto: false,
      sex: 'FEMALE',
      createdAt: '2025-01-02T00:00:00.000Z',
    });
    mockedMilestoneApi.listMilestones.mockResolvedValue([]);
    mockedHouseholdApi.listHouseholdMembers.mockResolvedValue([]);

    renderAppAt('/households/h1/children/c1/milestones');

    expect(await screen.findByRole('heading', { name: 'Milestones — Mia' })).toBeInTheDocument();
  });
});
