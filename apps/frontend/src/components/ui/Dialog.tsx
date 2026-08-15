/* eslint-disable react-refresh/only-export-components --
   Compound component: the root and its Header/Body/Footer sub-components (plus
   the exported prop types) intentionally live in one file; the one-export-per-
   file fast-refresh rule doesn't fit this shadcn-style pattern. */
import { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface DialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  /** Accessible name when no visible titled header is referenced. */
  'aria-label'?: string;
  /** Id of the element (e.g. a Dialog.Header heading) naming the dialog. */
  'aria-labelledby'?: string;
}

function DialogRoot({ isOpen, onOpenChange, children, className, ...aria }: DialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Mirror ConfirmDialog's proven native-<dialog> approach (showModal/close +
  // ESC/backdrop/focus-trap for free), generalized to a reusable controlled
  // API (see ADR-0013).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (isOpen && !dialog.open) {
      dialog.showModal();
      // Move focus into the dialog on open. Native showModal() already does
      // this in real browsers; doing it explicitly also gives a deterministic
      // focus target and works where showModal is polyfilled.
      const focusable = dialog.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      // The native `close` event fires for both `.close()` and the browser's
      // own ESC-dismiss, so routing it to `onOpenChange(false)` keeps ESC
      // behaviourally identical to closing programmatically.
      onClose={() => onOpenChange(false)}
      className={cn(
        'm-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50',
        className,
      )}
      {...aria}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t('ui.dialog.close')}
          className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
        {children}
      </div>
    </dialog>
  );
}

function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1 border-b border-border p-4 pr-12', className)}
      {...props}
    />
  );
}

function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 border-t border-border p-4', className)}
      {...props}
    />
  );
}

/**
 * Reusable modal dialog built on the native `<dialog>` element (no dialog
 * library — see ADR-0013), controlled via `isOpen`/`onOpenChange`. Compound
 * slots: `Dialog.Header` / `Dialog.Body` / `Dialog.Footer`. A close (✕) button
 * and ESC both call `onOpenChange(false)`; the native modal provides the
 * focus trap and backdrop.
 */
export const Dialog = Object.assign(DialogRoot, {
  Header: DialogHeader,
  Body: DialogBody,
  Footer: DialogFooter,
});
