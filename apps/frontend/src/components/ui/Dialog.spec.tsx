import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './Dialog';

function renderDialog(isOpen: boolean, props: Partial<Parameters<typeof Dialog>[0]> = {}) {
  const onOpenChange = props.onOpenChange ?? vi.fn();
  const utils = render(
    <Dialog isOpen={isOpen} {...props} onOpenChange={onOpenChange}>
      <Dialog.Header>
        <Dialog.Title>Delete entry?</Dialog.Title>
        <Dialog.Description>This action can't be undone.</Dialog.Description>
      </Dialog.Header>
      <Dialog.Body>The entry will be permanently removed.</Dialog.Body>
      <Dialog.Footer>
        <button type="button">Cancel</button>
        <button type="button">Delete</button>
      </Dialog.Footer>
    </Dialog>,
  );
  return { ...utils, onOpenChange };
}

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    renderDialog(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete entry?')).not.toBeInTheDocument();
  });

  it('renders its slots in a portaled dialog when opened', () => {
    renderDialog(true);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Delete entry?')).toBeInTheDocument();
    expect(screen.getByText("This action can't be undone.")).toBeInTheDocument();
    expect(screen.getByText('The entry will be permanently removed.')).toBeInTheDocument();
  });

  it('names and describes itself from Dialog.Title / Dialog.Description', () => {
    renderDialog(true);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Delete entry?');
    expect(dialog).toHaveAccessibleDescription("This action can't be undone.");
  });

  it('moves focus into the dialog on open', () => {
    renderDialog(true);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('calls onOpenChange(false) when the close button is clicked', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog(true);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) on ESC', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog(true);

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('lets onEscapeKeyDown suppress the ESC dismissal', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog(true, {
      onOpenChange,
      onEscapeKeyDown: (event) => event.preventDefault(),
    });

    await user.keyboard('{Escape}');

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not dismiss when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog(true);

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).not.toBeNull();
    await user.click(overlay as Element);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders no close button when hideCloseButton is set, leaving the rest intact', () => {
    renderDialog(true, { hideCloseButton: true });

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.getByText('Delete entry?')).toBeInTheDocument();
  });

  it('unmounts the dialog when isOpen goes back to false', () => {
    const { rerender } = renderDialog(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(
      <Dialog isOpen={false} onOpenChange={vi.fn()}>
        <Dialog.Body>content</Dialog.Body>
      </Dialog>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
