import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../components/ui';

/**
 * App-root banner for the `registerType: 'prompt'` service worker flow (see
 * vite.config.ts and ADR-0008): without this, a redeployed worker installs
 * but sits in the "waiting" state until every tab/window for the origin is
 * closed, so installed/PWA users silently keep running the previous app
 * shell — see the "No service worker update-prompt UI" entry this closes
 * out in docs/known-issues.md. Mirrors `ConflictNoticeBanner`'s
 * app-root/dismissible pattern; renders nothing once dismissed or when no
 * update is pending. No UI for `offlineReady` — only the redeploy-update gap
 * was the documented issue.
 *
 * `useRegisterSW` performs the actual `navigator.serviceWorker.register()`
 * call itself (replacing the old standalone `registerServiceWorker.ts`),
 * already guarded for non-PROD builds and unsupported browsers.
 */
export function ServiceWorkerUpdateBanner() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-20 flex flex-col gap-2 p-3" role="status">
      <div className="mx-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground shadow-md">
        <span>{t('pwa.update.message')}</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => void updateServiceWorker(true)}
          >
            {t('pwa.update.reloadButton')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:bg-primary-foreground/10"
            aria-label={t('pwa.update.dismissButton')}
            onClick={() => setNeedRefresh(false)}
          >
            {t('pwa.update.dismissButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}
