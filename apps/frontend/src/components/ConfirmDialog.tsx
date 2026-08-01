import { useEffect, useRef } from 'react';

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
 * Generic, reusable confirm/cancel modal built on the native `<dialog>`
 * element — `showModal()`/`close()` give ESC-dismiss, a focus trap, and
 * `::backdrop` styling for free, with zero new dependency. Intentionally
 * just this one component, not a portal/dialog-manager abstraction: the app
 * only needs a single concurrent confirm dialog at a time.
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
    >
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      <div>
        <button type="button" onClick={onCancel} disabled={isConfirming}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} disabled={isConfirming}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
