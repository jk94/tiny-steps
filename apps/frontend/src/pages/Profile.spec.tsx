import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Profile } from './Profile';
import type { AuthUser } from '../api/auth-api';
import * as useAuthModule from '../auth/useAuth';

vi.mock('../auth/useAuth');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

const testUser: AuthUser = {
  id: '1',
  email: 'parent@example.com',
  name: 'Bernd',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderProfile(
  overrides: { user?: AuthUser; updateName?: (name: string) => Promise<void> } = {},
) {
  const updateName = overrides.updateName ?? vi.fn().mockResolvedValue(undefined);
  mockedUseAuth.mockReturnValue({
    user: overrides.user ?? testUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    updateName,
    logout: vi.fn(),
  });
  const utils = render(<Profile />);
  return { ...utils, updateName };
}

describe('Profile', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('pre-fills the field with the current name', () => {
    renderProfile();

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Bernd');
  });

  it('starts empty for a legacy account that has no name yet', () => {
    renderProfile({ user: { ...testUser, name: null } });

    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('saves the trimmed new name and confirms it', async () => {
    const user = userEvent.setup();
    const { updateName } = renderProfile();

    const field = screen.getByLabelText('Name');
    await user.clear(field);
    await user.type(field, '  Bernadette  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateName).toHaveBeenCalledWith('Bernadette');
    expect(await screen.findByRole('status')).toHaveTextContent('Name saved.');
  });

  it('blocks submission and shows a validation error for an empty name', async () => {
    const user = userEvent.setup();
    const { updateName } = renderProfile();

    await user.clear(screen.getByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Please enter your name.')).toBeInTheDocument();
    expect(updateName).not.toHaveBeenCalled();
  });

  it('shows an error and no success notice when saving fails', async () => {
    const user = userEvent.setup();
    const updateName = vi.fn().mockRejectedValue(new Error('network down'));
    renderProfile({ updateName });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText("Couldn't save your name. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
