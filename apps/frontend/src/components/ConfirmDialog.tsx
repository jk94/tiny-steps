import { Button, Dialog } from './ui';

const TITLE_ID = 'confirm-dialog-title';

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
 * Generic, reusable confirm/cancel modal. Renders through the shared `Dialog`
 * primitive — it used to manage its own parallel native `<dialog>` because it
 * needed one behavior `Dialog` didn't generalize (suppressing dismissal while
 * `isConfirming`); `Dialog` now exposes that through `onEscapeKeyDown`, so the
 * duplicate implementation is gone.
 *
 * Why suppress dismissal while confirming: both buttons are already disabled
 * once the action is in flight, so letting ESC (or the ✕) close the dialog
 * would be inconsistent — it would disappear while the mutation keeps running
 * (and still navigates) in the background.
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
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        // Guards the ✕ button (ESC is already handled by onEscapeKeyDown
        // below, which stops the event before it ever reaches this callback).
        if (!open && !isConfirming) {
          onCancel();
        }
      }}
      onEscapeKeyDown={(event) => {
        if (isConfirming) {
          event.preventDefault();
        }
      }}
      aria-labelledby={TITLE_ID}
    >
      <Dialog.Header>
        <Dialog.Title id={TITLE_ID}>{title}</Dialog.Title>
      </Dialog.Header>
      {description && (
        <Dialog.Body>
          <Dialog.Description>{description}</Dialog.Description>
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
    </Dialog>
  );
}
