import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';

export interface ConnectionStatusDotProps {
  isConnected: boolean;
}

/**
 * Real-time connection indicator in the header, as a small colored dot.
 *
 * Colour alone must never be the only signal (WCAG 1.4.1), so the same
 * translated string is exposed both as the accessible name (`role="status"` +
 * `aria-label`) and as a hover tooltip (`title`) — the dot is what the eye
 * catches at a glance, the text is what anyone who needs it can still reach.
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
    />
  );
}
