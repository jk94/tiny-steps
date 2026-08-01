import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Login } from './Login';
import { ApiError } from '../api/http-client';
import * as useAuthModule from '../auth/useAuth';

vi.mock('../auth/useAuth');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

function mockAuth(login: (email: string, password: string) => Promise<void>) {
  mockedUseAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    login,
    register: vi.fn(),
    logout: vi.fn(),
  });
}

function renderLoginAt(entry: { pathname: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<p>Dashboard stub</p>} />
        <Route path="/some/page" element={<p>Some page stub</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email address'), 'parent@example.com');
  await user.type(screen.getByLabelText('Password'), 'validpassword');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('Login', () => {
  it('renders the login heading', () => {
    mockAuth(vi.fn());
    renderLoginAt({ pathname: '/login' });

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('navigates to / after a successful login with no from-state', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockAuth(login);
    const user = userEvent.setup();
    renderLoginAt({ pathname: '/login' });

    await fillAndSubmit(user);

    expect(await screen.findByText('Dashboard stub')).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith('parent@example.com', 'validpassword');
  });

  it('navigates back to the originally requested page when from-state is set', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockAuth(login);
    const user = userEvent.setup();
    renderLoginAt({ pathname: '/login', state: { from: { pathname: '/some/page' } } });

    await fillAndSubmit(user);

    expect(await screen.findByText('Some page stub')).toBeInTheDocument();
  });

  it('shows the invalid-credentials error and stays on the login page when login rejects with 401', async () => {
    const login = vi.fn().mockRejectedValue(new ApiError(401, {}));
    mockAuth(login);
    const user = userEvent.setup();
    renderLoginAt({ pathname: '/login' });

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(login).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Dashboard stub')).not.toBeInTheDocument();
  });
});
