import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('associates the label with the textarea', () => {
    render(<Textarea label="Note" />);
    expect(screen.getByLabelText('Note')).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('accepts typed input', async () => {
    const user = userEvent.setup();
    render(<Textarea label="Note" />);
    const textarea = screen.getByLabelText('Note');
    await user.type(textarea, 'Slight rash');
    expect(textarea).toHaveValue('Slight rash');
  });

  it('is not marked invalid without an error', () => {
    render(<Textarea label="Note" />);
    expect(screen.getByLabelText('Note')).toHaveAttribute('aria-invalid', 'false');
  });

  it('wires aria-invalid and aria-describedby to the error message when errored', () => {
    render(<Textarea label="Note" error="The note must be at most 500 characters long." />);
    const textarea = screen.getByLabelText('Note');
    const message = screen.getByRole('alert');

    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(message).toHaveTextContent('The note must be at most 500 characters long.');
    expect(textarea.getAttribute('aria-describedby')).toBe(message.id);
  });

  it('generates a unique id per instance so labels do not cross-associate', () => {
    render(
      <>
        <Textarea label="First note" />
        <Textarea label="Second note" />
      </>,
    );

    const first = screen.getByLabelText('First note');
    const second = screen.getByLabelText('Second note');
    expect(first.id).not.toBe(second.id);
  });

  it('honors an explicitly supplied id', () => {
    render(<Textarea id="diaper-note" label="Note" />);
    expect(screen.getByLabelText('Note')).toHaveAttribute('id', 'diaper-note');
  });
});
