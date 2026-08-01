import { Link, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';

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
  const { t, i18n } = useTranslation();

  return (
    <>
      <header>
        <nav>
          <Link to="/">{t('nav.dashboardLink')}</Link>
        </nav>
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
