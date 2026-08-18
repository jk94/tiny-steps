import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MandatoryNameDialog } from './MandatoryNameDialog';
import * as useAuthModule from '../auth/useAuth';

vi.mock('../auth/useAuth');

const mockedUseAuth = vi.mocked(useAuthModule.useAuth);

function renderDialog(updateName = vi.fn().mockResolvedValue(undefined)) {
  mockedUseAuth.mockReturnValue({
    user: {
      id: '1',
      email: 'parent@example.com',
      name: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    updateName,
    logout: vi.fn(),
  });
  const utils = render(<MandatoryNameDialog />);
  return { ...utils, updateName };
}

describe('MandatoryNameDialog', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders as an open, titled dialog with a name field', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'What should we call you?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('offers no dismissal affordance at all', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    await user.click(overlay as Element);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('submits the trimmed name via updateName', async () => {
    const user = userEvent.setup();
    const { updateName } = renderDialog();

    await user.type(screen.getByLabelText('Name'), '  Bernd  ');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(updateName).toHaveBeenCalledWith('Bernd');
  });

  it('blocks submission and shows a validation error for an empty name', async () => {
    const user = userEvent.setup();
    const { updateName } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Please enter your name.')).toBeInTheDocument();
    expect(updateName).not.toHaveBeenCalled();
  });

  it('keeps the dialog open with the typed input intact when saving fails', async () => {
    const user = userEvent.setup();
    const updateName = vi.fn().mockRejectedValue(new Error('network down'));
    renderDialog(updateName);

    await user.type(screen.getByLabelText('Name'), 'Bernd');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText("Couldn't save your name. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Bernd');
  });
});
