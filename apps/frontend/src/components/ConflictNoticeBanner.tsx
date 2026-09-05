import { useTranslation } from 'react-i18next';
import { dismissConflictNotice, useConflictNotices } from '../offline/conflictNotices';
import { Button } from './ui';

/**
 * App-root banner that surfaces dropped buffered writes as small, dismissible
 * notices — never a blocking modal. Two kinds: a Last-Write-Wins conflict
 * (JC-3, a buffered edit/timer-stop overridden by a newer server write) and a
 * 403 (the user's household role may not perform that write). Mounted once near
 * the app root (see `main.tsx`); renders nothing when there are no notices.
 *
 * `role="status"` (a polite live region) so assistive tech announces the
 * outcome without stealing focus.
 */
export function ConflictNoticeBanner() {
  const { t } = useTranslation();
  const notices = useConflictNotices();

  if (notices.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-20 flex flex-col gap-2 p-3" role="status">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className="mx-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-md bg-warning px-4 py-2 text-sm text-warning-foreground shadow-md"
        >
          <span>
            {t(
              notice.kind === 'FORBIDDEN'
                ? 'offline.forbidden.message'
                : 'offline.conflict.message',
            )}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-warning-foreground hover:bg-warning-foreground/10"
            aria-label={t('offline.conflict.dismiss')}
            onClick={() => dismissConflictNotice(notice.id)}
          >
            {t('offline.conflict.dismiss')}
          </Button>
        </div>
      ))}
    </div>
  );
}
