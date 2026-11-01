import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Layout } from './Layout';
import * as useAuthModule from '../auth/useAuth';
import { queryClient } from '../lib/query-client';
import * as useRealtimeConnectionModule from '../realtime/useRealtimeConnection';
import * as useHouseholdRoleModule from '../household/useHouseholdRole';
import type { HouseholdRole } from '../lib/householdPermissions';

vi.mock('../auth/useAuth');
vi.mock('../realtime/useRealtimeConnection');
vi.mock('../household/useHouseholdRole');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);
const mockedUseRealtimeConnection = vi.mocked(useRealtimeConnectionModule.useRealtimeConnection);
const mockedUseHouseholdRole = vi.mocked(useHouseholdRoleModule.useHouseholdRole);

function mockRole(role: HouseholdRole | undefined) {
  mockedUseHouseholdRole.mockReturnValue({ role, household: undefined, isLoading: false });
}

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

/** Renders the layout on a route that carries a household + child context. */
function renderLayoutAt(path: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/households/:householdId/children/:childId/*" element={<Layout />} />
        </Routes>
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
    mockRole(undefined);
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

    expect(screen.getByRole('link', { name: 'Households' })).toBeInTheDocument();
    expect(headerLogoutButton()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch to German' }));

    expect(screen.getByRole('link', { name: 'Haushalte' })).toBeInTheDocument();
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
      expect(dot).toHaveTextContent('Connected');
    });

    it('labels the dot "Disconnected" when the socket is not (yet) connected', () => {
      mockAuthenticated();
      mockedUseRealtimeConnection.mockReturnValue({ socket: {} as never, isConnected: false });

      renderLayout();

      const dot = screen.getByTestId('realtime-connection-status');
      expect(dot).toHaveAttribute('aria-label', 'Disconnected');
      expect(dot).toHaveAttribute('title', 'Disconnected');
      expect(dot).toHaveTextContent('Disconnected');
    });

    // Colour is not a signal a screen reader can perceive, and the live region
    // only announces anything if its *content* changes — hence the visually
    // hidden status text inside the dot, and this assertion on the transition.
    it('swaps the visually hidden status text when the connection drops', () => {
      mockAuthenticated();
      mockedUseRealtimeConnection.mockReturnValue({ socket: {} as never, isConnected: true });

      const { rerender } = renderLayout();
      expect(screen.getByTestId('realtime-connection-status')).toHaveTextContent('Connected');

      mockedUseRealtimeConnection.mockReturnValue({ socket: {} as never, isConnected: false });
      rerender(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Layout />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const dot = screen.getByTestId('realtime-connection-status');
      expect(dot).toHaveAttribute('role', 'status');
      expect(dot).toHaveTextContent('Disconnected');
    });

    // The dot must live outside the mobile sheet so it stays readable at a
    // glance without opening the menu. The sheet's own copy only mounts once
    // opened (Radix defers mounting `Dialog.Content` until then), so this
    // still holds with the sheet closed.
    it('renders exactly one dot, regardless of viewport-specific header clusters', () => {
      mockAuthenticated();
      mockedUseRealtimeConnection.mockReturnValue({ socket: {} as never, isConnected: true });

      renderLayout();

      expect(screen.getAllByTestId('realtime-connection-status')).toHaveLength(1);
    });

    it('repeats the connection status inside the mobile sheet, with a visible label', async () => {
      mockAuthenticated();
      mockedUseRealtimeConnection.mockReturnValue({ socket: {} as never, isConnected: true });

      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Open menu' }));
      const sheet = screen.getByRole('dialog', { name: 'Main menu' });

      const dots = screen.getAllByTestId('realtime-connection-status');
      expect(dots).toHaveLength(2);
      expect(within(sheet).getByText('Connected')).toBeVisible();
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

describe('Layout child navigation', () => {
  beforeEach(() => {
    mockAuthenticated();
    mockedUseRealtimeConnection.mockReturnValue({ socket: null, isConnected: false });
    mockRole('OWNER');
  });

  function bottomBar() {
    // Both the sidebar and the bottom bar are "Child navigation"; the bottom
    // bar is the one holding the "More" button.
    return screen
      .getAllByRole('navigation', { name: 'Child navigation' })
      .find((nav) => within(nav).queryByRole('button', { name: 'More' }))!;
  }

  it('keeps the mobile bottom bar to overview, timeline, milestones and "more"', () => {
    renderLayoutAt('/households/h1/children/c1');

    const bar = bottomBar();
    expect(
      within(bar)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Overview', 'Timeline', 'Milestones']);
    expect(within(bar).getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(within(bar).queryByRole('link', { name: 'Feeding' })).not.toBeInTheDocument();
  });

  it('marks the current bottom-bar destination with aria-current', () => {
    renderLayoutAt('/households/h1/children/c1/timeline');

    expect(within(bottomBar()).getByRole('link', { name: 'Timeline' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('highlights "more" while on an area that lives behind it', () => {
    renderLayoutAt('/households/h1/children/c1/feeding/new');

    expect(within(bottomBar()).getByRole('button', { name: 'More' }).className).toContain(
      'text-primary',
    );
  });

  it('opens a sheet with every other area and the settings from "more"', async () => {
    const user = userEvent.setup();
    renderLayoutAt('/households/h1/children/c1');

    await user.click(within(bottomBar()).getByRole('button', { name: 'More' }));

    const sheet = await screen.findByRole('dialog', { name: 'All areas' });
    for (const [label, path] of [
      ['Feeding', 'feeding'],
      ['Sleep', 'sleep'],
      ['Diaper', 'diaper'],
      ['Growth', 'growth'],
      ['Medical', 'health'],
      ['Development', 'development'],
      ['Settings', 'settings'],
    ]) {
      expect(within(sheet).getByRole('link', { name: label })).toHaveAttribute(
        'href',
        `/households/h1/children/c1/${path}`,
      );
    }
  });

  it('closes the "more" sheet when one of its areas is followed', async () => {
    const user = userEvent.setup();
    renderLayoutAt('/households/h1/children/c1');

    await user.click(within(bottomBar()).getByRole('button', { name: 'More' }));
    const sheet = await screen.findByRole('dialog', { name: 'All areas' });
    await user.click(within(sheet).getByRole('link', { name: 'Sleep' }));

    expect(screen.queryByRole('dialog', { name: 'All areas' })).not.toBeInTheDocument();
  });

  it.each(['OWNER', 'CO_PARENT', 'CAREGIVER'] as const)(
    'offers the quick-add button to a %s',
    (role) => {
      mockRole(role);
      renderLayoutAt('/households/h1/children/c1');

      expect(screen.getByRole('button', { name: 'Quick add' })).toBeInTheDocument();
    },
  );

  it('hides the quick-add button from an OBSERVER, who may not log entries', () => {
    mockRole('OBSERVER');
    renderLayoutAt('/households/h1/children/c1');

    expect(screen.queryByRole('button', { name: 'Quick add' })).not.toBeInTheDocument();
    // Without the docked FAB the bar needs no empty middle slot either.
    expect(bottomBar().querySelector('.grid-cols-4')).not.toBeNull();
  });

  it('shows no quick-add button outside a child context', () => {
    renderLayout();

    expect(screen.queryByRole('button', { name: 'Quick add' })).not.toBeInTheDocument();
  });

  it('offers a growth link inside a child context', () => {
    renderLayoutAt('/households/h1/children/c1');

    for (const link of screen.getAllByRole('link', { name: 'Growth' })) {
      expect(link).toHaveAttribute('href', '/households/h1/children/c1/growth');
    }
  });

  it('highlights the growth link while on a growth sub-route', () => {
    renderLayoutAt('/households/h1/children/c1/growth/new');

    // The active item is styled via the `text-primary` token class (there is
    // no aria-current in this nav); asserting the class is what pins the
    // `startsWith` matcher that makes sub-routes count as active.
    for (const link of screen.getAllByRole('link', { name: 'Growth' })) {
      expect(link.className).toContain('text-primary');
    }
  });

  it('offers a milestones link inside a child context', () => {
    renderLayoutAt('/households/h1/children/c1');

    for (const link of screen.getAllByRole('link', { name: 'Milestones' })) {
      expect(link).toHaveAttribute('href', '/households/h1/children/c1/milestones');
    }
  });

  it('highlights the milestones link while on a milestone sub-route', () => {
    renderLayoutAt('/households/h1/children/c1/milestones/new');

    for (const link of screen.getAllByRole('link', { name: 'Milestones' })) {
      expect(link.className).toContain('text-primary');
    }
  });

  it('offers a medical link inside a child context', () => {
    renderLayoutAt('/households/h1/children/c1');

    for (const link of screen.getAllByRole('link', { name: 'Medical' })) {
      expect(link).toHaveAttribute('href', '/households/h1/children/c1/health');
    }
  });

  it('highlights the medical link while on a health sub-route', () => {
    renderLayoutAt('/households/h1/children/c1/health/r1/edit');

    for (const link of screen.getAllByRole('link', { name: 'Medical' })) {
      expect(link.className).toContain('text-primary');
    }
  });

  it('renders no child navigation outside a child context', () => {
    renderLayout();

    expect(screen.queryByRole('link', { name: 'Growth' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Milestones' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Medical' })).not.toBeInTheDocument();
  });
});
