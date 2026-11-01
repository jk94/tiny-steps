import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '../../lib/cn';

export type SheetSide = 'right' | 'bottom';

export interface SheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Edge the panel slides in from: `right` for the app's navigation menu,
   * `bottom` for the thumb-reachable action sheets (quick add, "more" areas).
   */
  side?: SheetSide;
  /**
   * Visible heading, rendered as the dialog's `Title` — it then also provides
   * the accessible name, so `aria-label` becomes unnecessary.
   */
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Accessible name for the panel when it has no visible `title`. */
  'aria-label'?: string;
  /** Id of the element naming the panel, as an alternative to `aria-label`. */
  'aria-labelledby'?: string;
}

const SIDE_CLASSES: Record<SheetSide, string> = {
  right:
    'inset-y-0 right-0 h-full w-[85%] max-w-xs border-l data-[state=closed]:animate-slide-out-to-right data-[state=open]:animate-slide-in-from-right',
  // `inset-x-0` + `mx-auto` + a max width centres the panel on wide screens
  // without a transform, which the slide keyframes own.
  bottom:
    'inset-x-0 bottom-0 mx-auto max-h-[85vh] w-full max-w-lg rounded-t-xl border-t pb-[env(safe-area-inset-bottom)] data-[state=closed]:animate-slide-out-to-bottom data-[state=open]:animate-slide-in-from-bottom',
};

/**
 * Edge-anchored slide-in panel: the mobile navigation menu (`right`) and the
 * bottom action sheets (`bottom`). Built on Radix's Dialog primitive — Radix
 * ships no dedicated Sheet, and a sheet *is* a modal dialog, just positioned
 * against an edge instead of centred (the same approach shadcn/ui takes).
 * Radix owns the portal, focus trap, scroll lock, inert background and ESC
 * handling.
 *
 * Unlike this design system's `Dialog`, a Sheet **does** dismiss on an outside
 * click: it holds navigation or a quick action rather than a decision to
 * confirm, and tapping the dimmed area beside a slide-out panel is the
 * expected way to close it on touch.
 *
 * The enter/exit slide and the backdrop fade run on hand-rolled `@keyframes`
 * (see `src/styles/animations.css`) gated on Radix's `data-state`, so no
 * animation plugin is required. Keyframes rather than a CSS transition on
 * purpose: Radix's `Presence` defers unmounting only for an `animationend`
 * event, so a transition-based exit would never be seen. That file also
 * disables the motion under `prefers-reduced-motion: reduce`.
 */
export function Sheet({
  isOpen,
  onOpenChange,
  side = 'right',
  title,
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
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
        />
        <DialogPrimitive.Content
          data-slot="sheet-content"
          data-side={side}
          className={cn(
            'fixed z-50 flex flex-col border-border bg-background text-foreground shadow-lg focus-visible:outline-none',
            SIDE_CLASSES[side],
            className,
          )}
          {...aria}
        >
          {side === 'bottom' && (
            <span
              aria-hidden="true"
              className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30"
            />
          )}
          <div
            className={cn(
              'flex items-center gap-2 p-2',
              title ? 'justify-between pl-4' : 'justify-end',
            )}
          >
            {title && (
              <DialogPrimitive.Title className="text-lg font-extrabold text-foreground">
                {title}
              </DialogPrimitive.Title>
            )}
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
          <div className={cn('flex-1 overflow-y-auto p-4', title && 'pt-1')}>{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
