import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './Dialog';

// jsdom doesn't implement HTMLDialogElement.showModal()/.close() — polyfill
// just enough (toggling the reflected `open` attribute + a `close` event) to
// exercise the same wiring the component relies on in real browsers (same
// approach as ConfirmDialog.spec.tsx).
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  });
});

function renderDialog(isOpen: boolean, onOpenChange = vi.fn()) {
  return render(
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} aria-label="Example dialog">
      <Dialog.Header>Delete entry?</Dialog.Header>
      <Dialog.Body>This action can't be undone.</Dialog.Body>
      <Dialog.Footer>
        <button type="button">Cancel</button>
        <button type="button">Delete</button>
      </Dialog.Footer>
    </Dialog>,
  );
}

describe('Dialog', () => {
  it('calls showModal() and renders its slots when opened', () => {
    const { rerender } = renderDialog(false);
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();

    rerender(
      <Dialog isOpen onOpenChange={vi.fn()} aria-label="Example dialog">
        <Dialog.Header>Delete entry?</Dialog.Header>
        <Dialog.Body>This action can't be undone.</Dialog.Body>
      </Dialog>,
    );

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Delete entry?')).toBeInTheDocument();
    expect(screen.getByText("This action can't be undone.")).toBeInTheDocument();
  });

  it('moves focus into the dialog on open', () => {
    renderDialog(true);
    const dialog = document.querySelector('dialog')!;
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('calls onOpenChange(false) when the close button is clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderDialog(true, onOpenChange);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) on the native close event (ESC)', () => {
    const onOpenChange = vi.fn();
    renderDialog(true, onOpenChange);

    document.querySelector('dialog')!.dispatchEvent(new Event('close'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls close() when isOpen goes back to false', () => {
    const { rerender } = renderDialog(true);
    rerender(
      <Dialog isOpen={false} onOpenChange={vi.fn()} aria-label="Example dialog">
        <Dialog.Body>content</Dialog.Body>
      </Dialog>,
    );
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
  });
});
