import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AuthForm } from './AuthForm';
import { ApiError } from '../api/http-client';

function renderAuthForm(mode: 'login' | 'register', onSubmit: (...args: unknown[]) => unknown) {
  return render(
    <MemoryRouter>
      <AuthForm mode={mode} onSubmit={onSubmit as never} />
    </MemoryRouter>,
  );
}

describe.each([['login'], ['register']] as const)('AuthForm (mode: %s)', (mode) => {
  it('renders labeled email/password fields', () => {
    renderAuthForm(mode, vi.fn());

    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders the correct submit button text', () => {
    renderAuthForm(mode, vi.fn());

    const expectedText = mode === 'login' ? 'Log in' : 'Register';
    expect(screen.getByRole('button', { name: expectedText })).toBeInTheDocument();
  });

  it('renders the correct mode-switch link text', () => {
    renderAuthForm(mode, vi.fn());

    const expectedText =
      mode === 'login' ? 'Need an account? Register' : 'Already have an account? Log in';
    expect(screen.getByRole('link', { name: expectedText })).toBeInTheDocument();
  });

  it('blocks submission and shows a validation error for an invalid email', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderAuthForm(mode, onSubmit);

    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'validpassword');
    await user.click(
      screen.getByRole('button', { name: mode === 'login' ? 'Log in' : 'Register' }),
    );

    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a validation error for a too-short password', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderAuthForm(mode, onSubmit);

    await user.type(screen.getByLabelText('Email address'), 'parent@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(
      screen.getByRole('button', { name: mode === 'login' ? 'Log in' : 'Register' }),
    );

    expect(screen.getByText('Password must be at least 8 characters long.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with the exact entered email/password on valid input', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAuthForm(mode, onSubmit);

    await user.type(screen.getByLabelText('Email address'), 'parent@example.com');
    await user.type(screen.getByLabelText('Password'), 'validpassword');
    await user.click(
      screen.getByRole('button', { name: mode === 'login' ? 'Log in' : 'Register' }),
    );

    expect(onSubmit).toHaveBeenCalledWith('parent@example.com', 'validpassword');
  });

  it('shows the invalid-credentials error on a 401 rejection and re-enables the submit button', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(401, {}));
    const user = userEvent.setup();
    renderAuthForm(mode, onSubmit);

    await user.type(screen.getByLabelText('Email address'), 'parent@example.com');
    await user.type(screen.getByLabelText('Password'), 'validpassword');
    await user.click(
      screen.getByRole('button', { name: mode === 'login' ? 'Log in' : 'Register' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(
      screen.getByRole('button', { name: mode === 'login' ? 'Log in' : 'Register' }),
    ).toBeEnabled();
  });
});

describe('AuthForm (mode: register, 409 handling)', () => {
  it('shows the email-already-registered error on a 409 rejection', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(409, {}));
    const user = userEvent.setup();
    renderAuthForm('register', onSubmit);

    await user.type(screen.getByLabelText('Email address'), 'parent@example.com');
    await user.type(screen.getByLabelText('Password'), 'validpassword');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This email address is already registered.',
    );
  });
});

describe('AuthForm (error clearing)', () => {
  it('clears a stale form-level error when a subsequent submit fails client-side validation', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(401, {}));
    const user = userEvent.setup();
    renderAuthForm('login', onSubmit);

    await user.type(screen.getByLabelText('Email address'), 'parent@example.com');
    await user.type(screen.getByLabelText('Password'), 'validpassword');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Email address'));
    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(screen.queryByText('Invalid email or password.')).not.toBeInTheDocument();
  });

  it('clears a field-level error as soon as the user edits that field, without resubmitting', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderAuthForm('login', onSubmit);

    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'validpassword');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    const emailInput = screen.getByLabelText('Email address');
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');

    await user.type(emailInput, '.com');

    expect(screen.queryByText('Please enter a valid email address.')).not.toBeInTheDocument();
    expect(emailInput).toHaveAttribute('aria-invalid', 'false');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('AuthForm (pending state)', () => {
  it('disables the submit button and shows pending text while onSubmit is in flight', async () => {
    let resolveSubmit: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const user = userEvent.setup();
    renderAuthForm('login', onSubmit);

    await user.type(screen.getByLabelText('Email address'), 'parent@example.com');
    await user.type(screen.getByLabelText('Password'), 'validpassword');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    const pendingButton = await screen.findByRole('button', { name: 'Logging in…' });
    expect(pendingButton).toBeDisabled();

    resolveSubmit!();
  });
});
