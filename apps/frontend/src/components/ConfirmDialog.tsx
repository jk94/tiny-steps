import { useEffect, useRef } from 'react';
import { Button, Dialog } from './ui';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

/**
 * Generic, reusable confirm/cancel modal. Renders through the `Dialog`
 * primitive's `Header`/`Body`/`Footer` slots for styling, but manages its
 * own native `<dialog>` (not `Dialog`'s root) because it needs one behavior
 * `Dialog` doesn't generalize: suppressing ESC-dismiss while `isConfirming`
 * (see below) — this component predates, and is the documented precedent
 * for, `Dialog`'s own showModal()/close() approach (see ADR-0013).
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isConfirming = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    // The native `close` event fires both for a programmatic `.close()` call
    // and for the browser's own ESC-dismiss — routing it to `onCancel`
    // keeps ESC behaviourally identical to clicking "Cancel". But the
    // (cancelable) `cancel` event fires *before* `close`, specifically for
    // ESC — while a confirm action is in flight (`isConfirming`), both
    // buttons are already disabled, so ESC dismissing the dialog would be
    // inconsistent: the dialog would visually close while the mutation
    // keeps running (and still navigates) in the background. Prevent that
    // by cancelling the `cancel` event itself, making ESC a no-op in that
    // state (the `close` handler below then never fires for it).
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        if (isConfirming) {
          event.preventDefault();
        }
      }}
      onClose={onCancel}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50"
    >
      <Dialog.Header>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </Dialog.Header>
      {description && (
        <Dialog.Body>
          <p className="text-sm text-muted-foreground">{description}</p>
        </Dialog.Body>
      )}
      <Dialog.Footer>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={isConfirming}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onConfirm}
          isLoading={isConfirming}
        >
          {confirmLabel}
        </Button>
      </Dialog.Footer>
    </dialog>
  );
}
