import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Register } from './Register';
import { ApiError } from '../api/http-client';
import * as useAuthModule from '../auth/useAuth';

vi.mock('../auth/useAuth');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

function mockAuth(register: (email: string, password: string) => Promise<void>) {
  mockedUseAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register,
    logout: vi.fn(),
  });
}

function renderRegisterAt(entry: { pathname: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<p>Dashboard stub</p>} />
        <Route path="/some/page" element={<p>Some page stub</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email address'), 'parent@example.com');
  await user.type(screen.getByLabelText('Password'), 'validpassword');
  await user.click(screen.getByRole('button', { name: 'Register' }));
}

describe('Register', () => {
  it('renders the register heading', () => {
    mockAuth(vi.fn());
    renderRegisterAt({ pathname: '/register' });

    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
  });

  it('navigates to / after a successful registration with no from-state', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    mockAuth(register);
    const user = userEvent.setup();
    renderRegisterAt({ pathname: '/register' });

    await fillAndSubmit(user);

    expect(await screen.findByText('Dashboard stub')).toBeInTheDocument();
    expect(register).toHaveBeenCalledWith('parent@example.com', 'validpassword');
  });

  it('navigates back to the originally requested page when from-state is set', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    mockAuth(register);
    const user = userEvent.setup();
    renderRegisterAt({ pathname: '/register', state: { from: { pathname: '/some/page' } } });

    await fillAndSubmit(user);

    expect(await screen.findByText('Some page stub')).toBeInTheDocument();
  });

  it('shows the already-registered error and stays on the register page when register rejects with 409', async () => {
    const register = vi.fn().mockRejectedValue(new ApiError(409, {}));
    mockAuth(register);
    const user = userEvent.setup();
    renderRegisterAt({ pathname: '/register' });

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This email address is already registered.',
    );
    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
    expect(register).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Dashboard stub')).not.toBeInTheDocument();
  });
});
