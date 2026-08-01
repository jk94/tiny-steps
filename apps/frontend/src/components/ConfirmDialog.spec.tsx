import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

// jsdom doesn't implement `HTMLDialogElement.showModal()`/`.close()` (see
// https://github.com/jsdom/jsdom/issues/3294) — polyfill just enough of the
// native behaviour (toggling the reflected `open` attribute, and `close()`
// firing a `close` event) for these tests to exercise the same
// showModal/close/close-event wiring `ConfirmDialog` relies on in real
// browsers.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  });
});

const baseProps = {
  title: 'Delete child profile?',
  description: "This action can't be undone.",
  confirmLabel: 'Delete permanently',
  cancelLabel: 'Cancel',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDialog', () => {
  it('calls showModal() when isOpen becomes true', () => {
    const { rerender } = render(<ConfirmDialog {...baseProps} isOpen={false} />);
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();

    rerender(<ConfirmDialog {...baseProps} isOpen={true} />);

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
  });

  it('calls close() when isOpen becomes false after being open', () => {
    const { rerender } = render(<ConfirmDialog {...baseProps} isOpen={true} />);
    expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled();

    rerender(<ConfirmDialog {...baseProps} isOpen={false} />);

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
  });

  it('renders the title, description, and both buttons', () => {
    render(<ConfirmDialog {...baseProps} isOpen={true} />);

    expect(screen.getByText('Delete child profile?')).toBeInTheDocument();
    expect(screen.getByText("This action can't be undone.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...baseProps} isOpen={true} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...baseProps} isOpen={true} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the dialog fires its native close event (e.g. ESC)', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} isOpen={true} onCancel={onCancel} />);

    const dialog = document.querySelector('dialog')!;
    dialog.dispatchEvent(new Event('close'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('prevents the native cancel event (ESC) from closing the dialog while isConfirming is true', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} isOpen={true} onCancel={onCancel} isConfirming={true} />);

    const dialog = document.querySelector('dialog')!;
    const cancelEvent = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancelEvent);

    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
    expect(dialog).toHaveAttribute('open');
  });

  it('does not prevent the native cancel event (ESC) when isConfirming is false, so the ensuing close still calls onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} isOpen={true} onCancel={onCancel} isConfirming={false} />);

    const dialog = document.querySelector('dialog')!;
    const cancelEvent = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(false);

    // In a real browser, an unprevented `cancel` event is immediately
    // followed by the browser's own `close()` call (and its `close` event)
    // — jsdom doesn't wire that chain up automatically, so trigger it
    // explicitly here to cover the regression: ESC still behaves like
    // clicking "Cancel" when no confirm action is in flight.
    dialog.dispatchEvent(new Event('close'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while isConfirming is true', () => {
    render(<ConfirmDialog {...baseProps} isOpen={true} isConfirming={true} />);

    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
