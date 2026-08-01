import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { Layout } from './Layout';
import * as useAuthModule from '../auth/useAuth';
import * as householdApi from '../api/household-api';
import { queryClient } from '../lib/query-client';

vi.mock('../auth/useAuth');
vi.mock('../api/household-api');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);
const mockedHouseholdApi = vi.mocked(householdApi);

function renderLayout() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Layout', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedHouseholdApi.listHouseholds.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('renders no email/logout button when unauthenticated', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderLayout();

    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });

  it('shows the user email and a logout button when authenticated', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'parent@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderLayout();

    expect(screen.getByText('parent@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('calls logout() when the logout button is clicked', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'parent@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout,
    });

    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('renders the language switcher buttons with the correct aria-labels', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderLayout();

    expect(screen.getByRole('button', { name: 'Switch to German' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to English' })).toBeInTheDocument();
  });

  it('switches the rendered nav/logout text to German and back via the switcher buttons', async () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'parent@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    renderLayout();

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch to German' }));

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument();

    // The switcher buttons' own aria-labels are themselves translated, so
    // the English-switch button is now addressed by its German label.
    await user.click(screen.getByRole('button', { name: 'Zu Englisch wechseln' }));

    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('renders the households nav link', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderLayout();

    expect(screen.getByRole('link', { name: 'Households' })).toHaveAttribute('href', '/households');
  });

  it('does not render the household switcher when unauthenticated', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderLayout();

    expect(mockedHouseholdApi.listHouseholds).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: 'Switch household' })).not.toBeInTheDocument();
  });

  it("renders the household switcher with the user's households when authenticated", async () => {
    mockedHouseholdApi.listHouseholds.mockResolvedValueOnce([
      { id: 'h1', name: 'Team Müller', role: 'OWNER', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'parent@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    renderLayout();

    expect(await screen.findByRole('combobox', { name: 'Switch household' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Team Müller' })).toBeInTheDocument();
  });
});
