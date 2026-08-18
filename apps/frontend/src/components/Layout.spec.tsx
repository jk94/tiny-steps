import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { Layout } from './Layout';
import * as useAuthModule from '../auth/useAuth';
import { queryClient } from '../lib/query-client';
import * as useRealtimeConnectionModule from '../realtime/useRealtimeConnection';

vi.mock('../auth/useAuth');
vi.mock('../realtime/useRealtimeConnection');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);
const mockedUseRealtimeConnection = vi.mocked(useRealtimeConnectionModule.useRealtimeConnection);

type AuthOverrides = Partial<ReturnType<typeof useAuthModule.useAuth>>;

function mockAuthenticated(overrides: AuthOverrides = {}) {
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
    ...overrides,
  });
}

function mockUnauthenticated() {
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
}

function renderLayout() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The header's own logout button — the mobile sheet renders a second one. */
function headerLogoutButton() {
  return screen.queryByRole('button', { name: 'Log out' });
}

describe('Layout', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedUseRealtimeConnection.mockReturnValue({ socket: null, isConnected: false });
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('renders no user/logout controls when unauthenticated', () => {
    mockUnauthenticated();

    renderLayout();

    expect(headerLogoutButton()).not.toBeInTheDocument();
    expect(screen.queryByText('parent@example.com')).not.toBeInTheDocument();
  });

  it('shows the user name (not the email) and an icon-only logout button when authenticated', () => {
    mockAuthenticated();

    renderLayout();

    expect(screen.getByText('Bernd')).toBeInTheDocument();
    expect(screen.queryByText('parent@example.com')).not.toBeInTheDocument();
    // Icon-only now: the accessible name comes from aria-label, not text.
    expect(headerLogoutButton()).toBeInTheDocument();
  });

  it('falls back to the email when the user has no name yet', () => {
    mockAuthenticated({
      user: {
        id: '1',
        email: 'parent@example.com',
        name: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    renderLayout();

    expect(screen.getAllByText('parent@example.com').length).toBeGreaterThan(0);
  });

  it('links the user name to the profile page', () => {
    mockAuthenticated();

    renderLayout();

    expect(screen.getByRole('link', { name: /Bernd/ })).toHaveAttribute('href', '/profile');
  });

  it('calls logout() when the logout button is clicked', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    mockAuthenticated({ logout });

    const user = userEvent.setup();
    renderLayout();

    await user.click(headerLogoutButton()!);

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('renders the language switcher buttons with the correct aria-labels', () => {
    mockUnauthenticated();

    renderLayout();

    expect(screen.getByRole('button', { name: 'Switch to German' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to English' })).toBeInTheDocument();
  });

  it('switches the rendered nav/logout text to German and back via the switcher buttons', async () => {
    mockAuthenticated();

    const user = userEvent.setup();
    renderLayout();

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(headerLogoutButton()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch to German' }));

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument();

    // The switcher buttons' own aria-labels are themselves translated, so
    // the English-switch button is now addressed by its German label.
    await user.click(screen.getByRole('button', { name: 'Zu Englisch wechseln' }));

    expect(headerLogoutButton()).toBeInTheDocument();
  });

  it('renders the global nav links', () => {
    mockUnauthenticated();

    renderLayout();

    expect(screen.getByRole('link', { name: 'Households' })).toHaveAttribute('href', '/households');
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
  });

  describe('mobile menu sheet', () => {
    it('is closed until the hamburger is clicked', () => {
      mockAuthenticated();

      renderLayout();

      expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Main menu' })).not.toBeInTheDocument();
    });

    it('opens on the hamburger and holds the nav links, language switch, profile link and logout', async () => {
      mockAuthenticated();

      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Open menu' }));

      const sheet = screen.getByRole('dialog', { name: 'Main menu' });
      expect(within(sheet).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
      expect(within(sheet).getByRole('link', { name: 'Households' })).toBeInTheDocument();
      expect(within(sheet).getByRole('link', { name: /Bernd/ })).toHaveAttribute(
        'href',
        '/profile',
      );
      expect(within(sheet).getByRole('button', { name: 'Switch to German' })).toBeInTheDocument();
      expect(within(sheet).getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    });

    it('closes again on its close button', async () => {
      mockAuthenticated();

      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Open menu' }));
      const sheet = screen.getByRole('dialog', { name: 'Main menu' });

      await user.click(within(sheet).getByRole('button', { name: 'Close' }));

      expect(screen.queryByRole('dialog', { name: 'Main menu' })).not.toBeInTheDocument();
    });

    it('closes when a nav link inside it is followed', async () => {
      mockAuthenticated();

      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Open menu' }));
      const sheet = screen.getByRole('dialog', { name: 'Main menu' });

      await user.click(within(sheet).getByRole('link', { name: 'Households' }));

      expect(screen.queryByRole('dialog', { name: 'Main menu' })).not.toBeInTheDocument();
    });

    // `Layout` isn't unmounted by logging out — it wraps the login route too —
    // so an unclosed sheet would stay open on top of the login page.
    it('closes when logging out from inside it', async () => {
      const logout = vi.fn().mockResolvedValue(undefined);
      mockAuthenticated({ logout });

      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Open menu' }));
      const sheet = screen.getByRole('dialog', { name: 'Main menu' });

      await user.click(within(sheet).getByRole('button', { name: 'Log out' }));

      expect(logout).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog', { name: 'Main menu' })).not.toBeInTheDocument();
    });
  });

  describe('connection status', () => {
    it('shows no connection dot when unauthenticated (no socket exists yet)', () => {
      mockUnauthenticated();
      mockedUseRealtimeConnection.mockReturnValue({ socket: null, isConnected: false });

      renderLayout();

      expect(screen.queryByTestId('realtime-connection-status')).not.toBeInTheDocument();
    });

    it('labels the dot "Connected" when the socket is connected', () => {
      mockAuthenticated();
      mockedUseRealtimeConnection.mockReturnValue({ socket: {} as never, isConnected: true });

      renderLayout();

      const dot = screen.getByTestId('realtime-connection-status');
      expect(dot).toHaveAttribute('aria-label', 'Connected');
      expect(dot).toHaveAttribute('title', 'Connected');
    });

    it('labels the dot "Disconnected" when the socket is not (yet) connected', () => {
      mockAuthenticated();
      mockedUseRealtimeConnection.mockReturnValue({ socket: {} as never, isConnected: false });

      renderLayout();

      const dot = screen.getByTestId('realtime-connection-status');
      expect(dot).toHaveAttribute('aria-label', 'Disconnected');
      expect(dot).toHaveAttribute('title', 'Disconnected');
    });

    // The dot must live outside the mobile sheet so it stays readable at a
    // glance without opening the menu.
    it('renders exactly one dot, regardless of viewport-specific header clusters', () => {
      mockAuthenticated();
      mockedUseRealtimeConnection.mockReturnValue({ socket: {} as never, isConnected: true });

      renderLayout();

      expect(screen.getAllByTestId('realtime-connection-status')).toHaveLength(1);
    });
  });

  describe('mandatory name dialog', () => {
    it('is not shown for a user who already has a name', () => {
      mockAuthenticated();

      renderLayout();

      expect(screen.queryByText('What should we call you?')).not.toBeInTheDocument();
    });

    it('blocks a user whose account has no name yet', () => {
      mockAuthenticated({
        user: {
          id: '1',
          email: 'parent@example.com',
          name: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      });

      renderLayout();

      expect(screen.getByRole('dialog', { name: 'What should we call you?' })).toBeInTheDocument();
    });

    it('is not shown to an unauthenticated visitor', () => {
      mockUnauthenticated();

      renderLayout();

      expect(screen.queryByText('What should we call you?')).not.toBeInTheDocument();
    });
  });
});
