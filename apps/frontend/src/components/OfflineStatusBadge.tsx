import { useTranslation } from 'react-i18next';
import type { LocalEventStatus } from '../offline/pendingEvents.db';

export interface OfflineStatusBadgeProps {
  /**
   * The buffer status of the row this badge annotates. `undefined` for a
   * server-confirmed row — the badge renders nothing in that case, so a
   * confirmed row stays visually unadorned.
   */
  status?: LocalEventStatus;
}

/**
 * Marks a timeline/list row that came from the local offline buffer rather than
 * the server, giving three visually distinct states: a confirmed row (no badge),
 * an in-flight `pending` row, and a `failed` row whose create round-trip didn't
 * reach the server. The `failed` variant carries `role="status"` so assistive
 * tech announces that the entry isn't actually saved.
 */
export function OfflineStatusBadge({ status }: OfflineStatusBadgeProps) {
  const { t } = useTranslation();

  if (status === undefined) {
    return null;
  }

  const isFailed = status === 'failed';
  const label = isFailed ? t('offline.status.failedLabel') : t('offline.status.pendingLabel');
  const text = isFailed ? t('offline.status.failed') : t('offline.status.pending');

  return (
    <span
      className={isFailed ? 'offline-badge offline-badge--failed' : 'offline-badge'}
      role={isFailed ? 'status' : undefined}
      aria-label={label}
      title={label}
    >
      {text}
    </span>
  );
}
