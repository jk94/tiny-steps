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

  it('generates a unique id per instance so labels do not cross-associate', () => {
    render(
      <>
        <Input label="First name" />
        <Input label="Last name" />
      </>,
    );

    const first = screen.getByLabelText('First name');
    const last = screen.getByLabelText('Last name');
    expect(first.id).not.toBe(last.id);
  });

  it('honors an explicitly supplied id', () => {
    render(<Input id="household-name" label="Household name" />);
    expect(screen.getByLabelText('Household name')).toHaveAttribute('id', 'household-name');
  });
});
