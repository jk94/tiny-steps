import { useTranslation } from 'react-i18next';
import { dismissConflictNotice, useConflictNotices } from '../offline/conflictNotices';
import { Button } from './ui';

/**
 * App-root banner that surfaces Last-Write-Wins conflicts (JC-3): when a
 * buffered edit/timer-stop is overridden by a newer server write, a small,
 * dismissible notice is shown here — never a blocking modal. Mounted once near
 * the app root (see `main.tsx`); renders nothing when there are no notices.
 *
 * `role="status"` (a polite live region) so assistive tech announces the
 * override without stealing focus.
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
          <span>{t('offline.conflict.message')}</span>
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
