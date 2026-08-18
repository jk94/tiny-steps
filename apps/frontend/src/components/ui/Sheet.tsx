import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '../../lib/cn';

export interface SheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edge the panel slides in from. Only `right` is needed today. */
  side?: 'right';
  children: ReactNode;
  className?: string;
  /** Accessible name for the panel — a sheet has no `Title` slot. */
  'aria-label'?: string;
  /** Id of the element naming the panel, as an alternative to `aria-label`. */
  'aria-labelledby'?: string;
}

/**
 * Edge-anchored slide-in panel, used for the mobile navigation menu. Built on
 * Radix's Dialog primitive — Radix ships no dedicated Sheet, and a sheet *is*
 * a modal dialog, just positioned against an edge instead of centred (the same
 * approach shadcn/ui takes). Radix owns the portal, focus trap, scroll lock,
 * inert background and ESC handling.
 *
 * Unlike this design system's `Dialog`, a Sheet **does** dismiss on an outside
 * click: it holds navigation rather than a decision to confirm, and tapping
 * the dimmed area beside a slide-out menu is the expected way to close it on
 * touch. The enter/exit slide is plain Tailwind transform utilities gated on
 * Radix's `data-state`, so no animation plugin is required.
 */
export function Sheet({
  isOpen,
  onOpenChange,
  side = 'right',
  children,
  className,
  ...aria
}: SheetProps) {
  const { t } = useTranslation();

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="sheet-overlay"
          className="fixed inset-0 z-50 bg-black/50"
        />
        <DialogPrimitive.Content
          data-slot="sheet-content"
          data-side={side}
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex h-full w-[85%] max-w-xs flex-col border-l border-border bg-background text-foreground shadow-lg focus-visible:outline-none',
            'transition-transform duration-300 ease-in-out data-[state=closed]:translate-x-full data-[state=open]:translate-x-0',
            className,
          )}
          {...aria}
        >
          <div className="flex justify-end p-2">
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label={t('ui.dialog.close')}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
