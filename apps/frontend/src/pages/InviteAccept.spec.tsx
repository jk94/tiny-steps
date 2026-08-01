import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { InviteAccept } from './InviteAccept';
import * as inviteApi from '../api/invite-api';
import * as useAuthModule from '../auth/useAuth';
import { ApiError } from '../api/http-client';
import { queryClient } from '../lib/query-client';

vi.mock('../api/invite-api');
vi.mock('../auth/useAuth');

const mockedInviteApi = vi.mocked(inviteApi);
const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

function mockAuth(overrides: Partial<ReturnType<typeof useAuthModule.useAuth>>) {
  mockedUseAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  });
}

function renderInviteAccept(token = 'a-token') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/invites/${token}`]}>
        <Routes>
          <Route path="/invites/:token" element={<InviteAccept />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InviteAccept', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    queryClient.clear();
  });

  it('shows the shared loading indicator while auth is loading', () => {
    mockAuth({ isLoading: true });
    mockedInviteApi.previewInvite.mockReturnValue(new Promise(() => {}));

    renderInviteAccept();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows the invite-specific loading text while the preview is loading', () => {
    mockAuth({});
    mockedInviteApi.previewInvite.mockReturnValue(new Promise(() => {}));

    renderInviteAccept();

    expect(screen.getByText('Checking invitation…')).toBeInTheDocument();
  });

  it('shows the guest prompt with login/register links for an unauthenticated visitor on a valid invite', async () => {
    mockAuth({ isAuthenticated: false });
    mockedInviteApi.previewInvite.mockResolvedValueOnce({
      status: 'valid',
      householdName: 'Team Müller',
      expiresAt: '2026-01-08T00:00:00.000Z',
    });

    renderInviteAccept();

    expect(
      await screen.findByText('You\'ve been invited to join the household "Team Müller".'),
    ).toBeInTheDocument();
    expect(screen.getByText('Log in or register to accept the invitation.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();
  });

  it('shows an accept button for an authenticated visitor on a valid invite, invalidates the households query, and navigates on success', async () => {
    mockAuth({
      isAuthenticated: true,
      user: { id: '1', email: 'a@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
    });
    mockedInviteApi.previewInvite.mockResolvedValueOnce({
      status: 'valid',
      householdName: 'Team Müller',
      expiresAt: '2026-01-08T00:00:00.000Z',
    });
    mockedInviteApi.acceptInvite.mockResolvedValueOnce({
      household: { id: 'h1', name: 'Team Müller' },
      role: 'CO_PARENT',
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    renderInviteAccept('a-token');
    const acceptButton = await screen.findByRole('button', { name: 'Accept invitation' });
    await user.click(acceptButton);

    expect(mockedInviteApi.acceptInvite).toHaveBeenCalledWith('a-token');
    await vi.waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['households'] }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/households/h1', { replace: true });
  });

  it.each([
    ['invalid', 'This invite link is invalid.'],
    ['expired', 'This invite link has expired.'],
    ['used', 'This invite link has already been used.'],
    ['revoked', 'This invite link has been revoked.'],
  ] as const)('shows the %s status message with no accept affordance', async (status, message) => {
    mockAuth({ isAuthenticated: true });
    mockedInviteApi.previewInvite.mockResolvedValueOnce({ status });

    renderInviteAccept();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
  });

  it('shows a mapped generic error message when the preview request itself fails', async () => {
    mockAuth({});
    mockedInviteApi.previewInvite.mockRejectedValueOnce(new ApiError(500, {}));

    renderInviteAccept();

    expect(
      await screen.findByText('Something went wrong. Please try again later.'),
    ).toBeInTheDocument();
  });
});
