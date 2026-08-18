import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';

export interface ConnectionStatusDotProps {
  isConnected: boolean;
  /**
   * Renders the translated status text visibly next to the dot instead of
   * only for screen readers — used in the mobile sheet, where the header's
   * dot-only version isn't visible without opening the menu.
   */
  showLabel?: boolean;
}

/**
 * Real-time connection indicator, as a small colored dot — in the header it's
 * dot-only; with `showLabel` (the mobile sheet) the status text renders
 * visibly too.
 *
 * Colour alone must never be the only signal (WCAG 1.4.1). The dot always
 * carries a copy of the translated status — visually hidden unless
 * `showLabel` — which does three things a bare `aria-label` can't: it gives
 * the `role="status"` live region actual text content, so a
 * connect/disconnect transition is genuinely announced (a live region whose
 * content never changes announces nothing); it keeps the status reachable in
 * a screen reader's browse mode; and it survives with no pointer, unlike the
 * `title` tooltip — this app is mobile-first, and hover doesn't exist on
 * touch. `aria-label` and `title` stay on top of that, for the accessible
 * name and for mouse users respectively.
 */
export function ConnectionStatusDot({ isConnected, showLabel = false }: ConnectionStatusDotProps) {
  const { t } = useTranslation();
  const label = t(
    isConnected ? 'layout.connectionStatus.connected' : 'layout.connectionStatus.disconnected',
  );

  return (
    <span
      data-testid="realtime-connection-status"
      role="status"
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-2"
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex h-2 w-2 shrink-0 rounded-full',
          isConnected ? 'bg-emerald-500' : 'bg-red-500',
        )}
      />
      <span className={showLabel ? 'text-sm text-foreground' : 'sr-only'}>{label}</span>
    </span>
  );
}
