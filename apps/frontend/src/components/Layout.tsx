import { Link, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { useRealtimeConnection } from '../realtime/useRealtimeConnection';
import { HouseholdSwitcher } from './HouseholdSwitcher';

/**
 * Minimal app shell shared by every route. Kept intentionally bare — real
 * navigation/branding follows once the actual login/register UI exists.
 *
 * The email + logout button here is a deliberate exception to "no UI this
 * sub-step": it's the manual, end-to-end proof that cookies/CSRF/protected
 * routing/logout actually work before the real login form exists.
 */
export function Layout() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { isConnected } = useRealtimeConnection();
  const { t, i18n } = useTranslation();

  return (
    <>
      <header>
        <nav>
          <Link to="/">{t('nav.dashboardLink')}</Link>
          <Link to="/households">{t('nav.householdsLink')}</Link>
        </nav>
        {!isLoading && isAuthenticated && <HouseholdSwitcher />}
        {/*
         * Placeholder language switcher — two plain buttons, no styling.
         * This belongs in a real settings area once one exists (Phase 6);
         * it lives here for now purely because that's the only screen
         * every route shares.
         */}
        <div>
          <button
            type="button"
            aria-label={t('language.switchToGerman')}
            onClick={() => void i18n.changeLanguage('de')}
          >
            DE
          </button>
          <button
            type="button"
            aria-label={t('language.switchToEnglish')}
            onClick={() => void i18n.changeLanguage('en')}
          >
            EN
          </button>
        </div>
        {!isLoading && isAuthenticated && user && (
          <div>
            {/* Connection status only makes sense once a socket exists at
                all, i.e. once authenticated (see RealtimeProvider) — same
                conditional-rendering gate as the email/logout block it sits
                next to. */}
            <span data-testid="realtime-connection-status">
              {isConnected
                ? t('layout.connectionStatus.connected')
                : t('layout.connectionStatus.disconnected')}
            </span>
            <span>{user.email}</span>
            <button type="button" onClick={() => void logout()}>
              {t('layout.logoutButton')}
            </button>
          </div>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
