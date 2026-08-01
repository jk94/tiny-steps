import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { Layout } from './Layout';
import * as useAuthModule from '../auth/useAuth';

vi.mock('../auth/useAuth');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

function renderLayout() {
  return render(
    <MemoryRouter>
      <Layout />
    </MemoryRouter>,
  );
}

describe('Layout', () => {
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
});
