import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  it('associates the label with the input', () => {
    render(<Input label="Email address" />);
    expect(screen.getByLabelText('Email address')).toBeInstanceOf(HTMLInputElement);
  });

  it('accepts typed input', async () => {
    const user = userEvent.setup();
    render(<Input label="Name" />);
    const input = screen.getByLabelText('Name');
    await user.type(input, 'Ada');
    expect(input).toHaveValue('Ada');
  });

  it('is not marked invalid without an error', () => {
    render(<Input label="Name" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'false');
  });

  it('wires aria-invalid and aria-describedby to the error message when errored', () => {
    render(<Input label="Amount" error="Please enter an amount." />);
    const input = screen.getByLabelText('Amount');
    const message = screen.getByRole('alert');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(message).toHaveTextContent('Please enter an amount.');
    expect(input.getAttribute('aria-describedby')).toBe(message.id);
  });
});
