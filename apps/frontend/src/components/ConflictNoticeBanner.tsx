import { useTranslation } from 'react-i18next';
import { dismissConflictNotice, useConflictNotices } from '../offline/conflictNotices';

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
    <div className="conflict-notice-banner" role="status">
      {notices.map((notice) => (
        <div key={notice.id} className="conflict-notice-banner__item">
          <span>{t('offline.conflict.message')}</span>
          <button
            type="button"
            aria-label={t('offline.conflict.dismiss')}
            onClick={() => dismissConflictNotice(notice.id)}
          >
            {t('offline.conflict.dismiss')}
          </button>
        </div>
      ))}
    </div>
  );
}
