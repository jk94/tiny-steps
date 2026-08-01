import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { Login } from './Login';
import { ApiError } from '../api/http-client';
import * as useAuthModule from '../auth/useAuth';
import * as oidcApi from '../api/oidc-api';
import { queryClient } from '../lib/query-client';

vi.mock('../auth/useAuth');
vi.mock('../api/oidc-api');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);
const mockedOidcApi = vi.mocked(oidcApi);

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

/** Renders the current search string so tests can assert it was stripped. */
function LocationSearchDisplay() {
  const location = useLocation();
  return <p data-testid="location-search">{location.search}</p>;
}

function renderLoginAt(entry: { pathname: string; state?: unknown }) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/login"
            element={
              <>
                <Login />
                <LocationSearchDisplay />
              </>
            }
          />
          <Route path="/" element={<p>Dashboard stub</p>} />
          <Route path="/some/page" element={<p>Some page stub</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email address'), 'parent@example.com');
  await user.type(screen.getByLabelText('Password'), 'validpassword');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('Login', () => {
  beforeEach(() => {
    queryClient.clear();
    mockedOidcApi.fetchOidcProviders.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

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

  it('shows the mapped error message for a known oidc_error code (invalid_state)', async () => {
    mockAuth(vi.fn());
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login?oidc_error=invalid_state']}>
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your sign-in session expired or was invalid. Please try again.',
    );
  });

  it('shows the generic fallback message for an unrecognized oidc_error code', async () => {
    mockAuth(vi.fn());
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login?oidc_error=something_weird']}>
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong signing you in. Please try again later.',
    );
  });

  it('shows no alert when there is no oidc_error param', () => {
    mockAuth(vi.fn());
    renderLoginAt({ pathname: '/login' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('strips the oidc_error param from the URL after mount', async () => {
    mockAuth(vi.fn());
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login?oidc_error=invalid_state']}>
          <Routes>
            <Route
              path="/login"
              element={
                <>
                  <Login />
                  <LocationSearchDisplay />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // The error stays visible even after the param is stripped ...
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your sign-in session expired or was invalid. Please try again.',
    );
    // ... but the URL itself no longer carries `oidc_error`, so a page
    // refresh wouldn't re-show it.
    expect(screen.getByTestId('location-search')).toHaveTextContent('');
  });
});
