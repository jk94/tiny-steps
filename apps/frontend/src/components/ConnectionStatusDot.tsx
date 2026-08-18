import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';

export interface ConnectionStatusDotProps {
  isConnected: boolean;
}

/**
 * Real-time connection indicator in the header, as a small colored dot.
 *
 * Colour alone must never be the only signal (WCAG 1.4.1). The dot carries a
 * visually hidden copy of the translated status, which does three things a
 * bare `aria-label` can't: it gives the `role="status"` live region actual
 * text content, so a connect/disconnect transition is genuinely announced
 * (a live region whose content never changes announces nothing); it keeps the
 * status reachable in a screen reader's browse mode; and it survives with no
 * pointer, unlike the `title` tooltip — this app is mobile-first, and hover
 * doesn't exist on touch. `aria-label` and `title` stay on top of that, for
 * the accessible name and for mouse users respectively.
 */
export function ConnectionStatusDot({ isConnected }: ConnectionStatusDotProps) {
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
      className={cn(
        'inline-flex h-2 w-2 shrink-0 rounded-full',
        isConnected ? 'bg-emerald-500' : 'bg-red-500',
      )}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}
