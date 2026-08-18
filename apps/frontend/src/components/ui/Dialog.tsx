/* eslint-disable react-refresh/only-export-components --
   Compound component: the root and its Title/Description/Header/Body/Footer
   sub-components (plus the exported prop types) intentionally live in one file;
   the one-export-per-file fast-refresh rule doesn't fit this shadcn-style
   pattern. */
import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '../../lib/cn';

export interface DialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  /**
   * Called when ESC is pressed. Call `event.preventDefault()` to suppress the
   * dismissal (e.g. while an action is in flight). Defaults to a no-op, so ESC
   * closes the dialog.
   */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** Accessible name when no `Dialog.Title` is rendered. */
  'aria-label'?: string;
  /** Id of the element (e.g. a `Dialog.Title`) naming the dialog. */
  'aria-labelledby'?: string;
}

function DialogRoot({
  isOpen,
  onOpenChange,
  children,
  className,
  onEscapeKeyDown,
  ...aria
}: DialogProps) {
  const { t } = useTranslation();

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="dialog-overlay"
          className="fixed inset-0 z-50 bg-black/50"
        />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          onEscapeKeyDown={onEscapeKeyDown}
          // Radix dismisses on an outside click by default. This design system
          // deliberately has no backdrop-click dismissal (carried over from the
          // native-<dialog> implementation this replaced), so both outside-
          // interaction escape hatches are suppressed here — see the Modal
          // styleguide entry. `onInteractOutside` also covers focus moving out,
          // not just pointer events.
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background text-foreground shadow-lg focus-visible:outline-none',
            className,
          )}
          {...aria}
        >
          <div className="relative">
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label={t('ui.dialog.close')}
                className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg font-bold text-foreground', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1 border-b border-border p-4 pr-12', className)}
      {...props}
    />
  );
}

function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="dialog-body" className={cn('p-4', className)} {...props} />;
}

function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex items-center justify-end gap-2 border-t border-border p-4', className)}
      {...props}
    />
  );
}

/**
 * Reusable modal dialog backed by Radix UI's Dialog primitive, controlled via
 * `isOpen`/`onOpenChange`. Radix owns the portal, focus trap, scroll lock,
 * inert background and ESC handling.
 *
 * Compound slots: `Dialog.Title` / `Dialog.Description` (which Radix wires to
 * the dialog's `aria-labelledby`/`aria-describedby`) plus the layout slots
 * `Dialog.Header` / `Dialog.Body` / `Dialog.Footer`. A close (✕) button and ESC
 * both call `onOpenChange(false)`; clicking the backdrop deliberately does
 * **not** dismiss. Pass `onEscapeKeyDown` to suppress ESC conditionally.
 */
export const Dialog = Object.assign(DialogRoot, {
  Title: DialogTitle,
  Description: DialogDescription,
  Header: DialogHeader,
  Body: DialogBody,
  Footer: DialogFooter,
});
