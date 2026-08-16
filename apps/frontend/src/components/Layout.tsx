import { Link, Outlet, useLocation, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Droplet, Home, Milk, Moon, Settings } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { useRealtimeConnection } from '../realtime/useRealtimeConnection';
import { HouseholdSwitcher } from './HouseholdSwitcher';
import { Button } from './ui';
import { cn } from '../lib/cn';

interface ChildNavItem {
  to: string;
  label: string;
  Icon: typeof Home;
  isActive: boolean;
}

/**
 * App shell shared by every route: a top bar (branding, household switcher,
 * language switch, connection status, logout) plus a secondary nav layer for
 * per-child routes — a bottom tab bar on mobile, a left sidebar from `lg:`
 * up. That secondary layer only appears once `householdId`/`childId` are
 * both present in the URL; there's no global "current household/child"
 * concept, so household-only or household-less routes (household list,
 * dashboard, login, …) fall back to just the top bar.
 */
export function Layout() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { isConnected } = useRealtimeConnection();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { householdId, childId } = useParams<{ householdId?: string; childId?: string }>();

  const hasChildContext = Boolean(householdId && childId);
  const homeTo = householdId ? `/households/${householdId}` : undefined;

  const childNavItems: ChildNavItem[] = hasChildContext
    ? [
        {
          to: homeTo!,
          label: t('nav.homeLink'),
          Icon: Home,
          isActive: location.pathname === homeTo,
        },
        {
          to: `/households/${householdId}/children/${childId}/feeding`,
          label: t('child.list.feedingLink'),
          Icon: Milk,
          isActive: location.pathname.startsWith(
            `/households/${householdId}/children/${childId}/feeding`,
          ),
        },
        {
          to: `/households/${householdId}/children/${childId}/sleep`,
          label: t('child.list.sleepLink'),
          Icon: Moon,
          isActive: location.pathname.startsWith(
            `/households/${householdId}/children/${childId}/sleep`,
          ),
        },
        {
          to: `/households/${householdId}/children/${childId}/diaper`,
          label: t('child.list.diaperLink'),
          Icon: Droplet,
          isActive: location.pathname.startsWith(
            `/households/${householdId}/children/${childId}/diaper`,
          ),
        },
        {
          to: `/households/${householdId}/children/${childId}/timeline`,
          label: t('child.list.timelineLink'),
          Icon: ClipboardList,
          isActive: location.pathname.startsWith(
            `/households/${householdId}/children/${childId}/timeline`,
          ),
        },
        {
          to: `/households/${householdId}/children/${childId}/notifications`,
          label: t('nav.settingsLink'),
          Icon: Settings,
          isActive: location.pathname.startsWith(
            `/households/${householdId}/children/${childId}/notifications`,
          ),
        },
      ]
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      {hasChildContext && (
        <aside className="hidden lg:flex lg:w-56 lg:flex-none lg:flex-col lg:gap-1 lg:border-r lg:border-border lg:bg-background lg:p-4">
          <div className="mb-4 flex items-center gap-2 px-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              B
            </span>
            <span className="text-sm font-bold text-foreground">Baby Tracker</span>
          </div>
          <nav aria-label={t('nav.childNavLabel')} className="flex flex-col gap-1">
            {childNavItems.map(({ to, label, Icon, isActive }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted',
                  isActive && 'bg-primary/10 text-primary hover:bg-primary/10',
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
      )}

      <div className="flex flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link to="/" className="text-foreground hover:text-primary">
              {t('nav.dashboardLink')}
            </Link>
            <Link to="/households" className="text-foreground hover:text-primary">
              {t('nav.householdsLink')}
            </Link>
          </nav>
          {!isLoading && isAuthenticated && <HouseholdSwitcher />}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t('language.switchToGerman')}
              onClick={() => void i18n.changeLanguage('de')}
            >
              DE
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t('language.switchToEnglish')}
              onClick={() => void i18n.changeLanguage('en')}
            >
              EN
            </Button>
          </div>
          {!isLoading && isAuthenticated && user && (
            <div className="flex items-center gap-3 text-sm">
              <span data-testid="realtime-connection-status" className="text-muted-foreground">
                {isConnected
                  ? t('layout.connectionStatus.connected')
                  : t('layout.connectionStatus.disconnected')}
              </span>
              <span className="text-muted-foreground">{user.email}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => void logout()}>
                {t('layout.logoutButton')}
              </Button>
            </div>
          )}
        </header>

        <main className={cn('flex-1 p-4', hasChildContext && 'pb-20 lg:pb-4')}>
          <Outlet />
        </main>
      </div>

      {hasChildContext && (
        <nav
          aria-label={t('nav.childNavLabel')}
          className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-background lg:hidden"
        >
          {childNavItems.map(({ to, label, Icon, isActive }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted-foreground',
                isActive && 'text-primary',
              )}
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
