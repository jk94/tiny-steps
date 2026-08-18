import { useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Droplet, Home, LogOut, Menu, Milk, Moon, Settings } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { useRealtimeConnection } from '../realtime/useRealtimeConnection';
import { ConnectionStatusDot } from './ConnectionStatusDot';
import { MandatoryNameDialog } from './MandatoryNameDialog';
import { Avatar, Button, Sheet } from './ui';
import { DeFlagIcon, GbFlagIcon } from './ui/icons/flags';
import { cn } from '../lib/cn';

interface ChildNavItem {
  to: string;
  label: string;
  Icon: typeof Home;
  isActive: boolean;
}

interface GlobalNavItem {
  to: string;
  label: string;
}

/** Shared by the desktop header nav and the mobile sheet, so they can't drift. */
function useGlobalNavItems(): GlobalNavItem[] {
  const { t } = useTranslation();
  return [
    { to: '/', label: t('nav.dashboardLink') },
    { to: '/households', label: t('nav.householdsLink') },
    { to: '/profile', label: t('nav.profileLink') },
  ];
}

/**
 * The DE/EN pair, rendered in both the desktop header and the mobile sheet.
 * The flags are decorative — each button's translated `aria-label` carries the
 * accessible name, since a flag is a country, not a language.
 */
function LanguageButtons({ onChangeLanguage }: { onChangeLanguage: (language: string) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t('language.switchToGerman')}
        onClick={() => onChangeLanguage('de')}
      >
        <DeFlagIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t('language.switchToEnglish')}
        onClick={() => onChangeLanguage('en')}
      >
        <GbFlagIcon />
      </Button>
    </>
  );
}

/**
 * App shell shared by every route: a top bar (global nav, language switch,
 * connection status, the signed-in user, logout) plus a secondary nav layer
 * for per-child routes — a bottom tab bar on mobile, a left sidebar from `lg:`
 * up. That secondary layer only appears once `householdId`/`childId` are
 * both present in the URL; there's no global "current household/child"
 * concept, so household-only or household-less routes (household list,
 * dashboard, login, …) fall back to just the top bar.
 *
 * Below `lg:` the top bar collapses to brand + connection dot + a hamburger
 * that opens everything else in a right-hand `Sheet`. The connection dot stays
 * outside the sheet on purpose — it's the one thing worth seeing at a glance
 * without opening a menu.
 */
export function Layout() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { isConnected } = useRealtimeConnection();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { householdId, childId } = useParams<{ householdId?: string; childId?: string }>();
  const globalNavItems = useGlobalNavItems();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const hasChildContext = Boolean(householdId && childId);
  const homeTo = householdId ? `/households/${householdId}` : undefined;
  const showSessionControls = !isLoading && isAuthenticated && !!user;
  const displayName = user?.name ?? user?.email ?? '';

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
        <header className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
          <nav className="hidden items-center gap-4 text-sm font-medium lg:flex">
            {globalNavItems.map(({ to, label }) => (
              <Link key={to} to={to} className="text-foreground hover:text-primary">
                {label}
              </Link>
            ))}
          </nav>
          <span className="text-sm font-bold text-foreground lg:hidden">Baby Tracker</span>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 lg:flex">
              <LanguageButtons onChangeLanguage={(lng) => void i18n.changeLanguage(lng)} />
            </div>

            {/* Rendered exactly once, outside both the desktop cluster and the
                mobile sheet, so it stays visible at every viewport width. */}
            {showSessionControls && <ConnectionStatusDot isConnected={isConnected} />}

            {showSessionControls && (
              <div className="hidden items-center gap-2 lg:flex">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 rounded-md px-1 py-1 text-sm text-foreground hover:bg-muted"
                >
                  <Avatar name={displayName} size="sm" />
                  <span>{displayName}</span>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('layout.logoutButton')}
                  onClick={() => void logout()}
                >
                  <LogOut aria-hidden="true" />
                </Button>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="lg:hidden"
              aria-label={t('nav.openMenu')}
              onClick={() => setIsMenuOpen(true)}
            >
              <Menu aria-hidden="true" />
            </Button>
          </div>

          <Sheet
            isOpen={isMenuOpen}
            onOpenChange={setIsMenuOpen}
            aria-label={t('nav.mobileMenuLabel')}
          >
            <div className="flex flex-col gap-4">
              <nav className="flex flex-col gap-1">
                {globalNavItems.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    {label}
                  </Link>
                ))}
              </nav>

              <div className="flex items-center gap-1 border-t border-border pt-4">
                <LanguageButtons onChangeLanguage={(lng) => void i18n.changeLanguage(lng)} />
              </div>

              {showSessionControls && (
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <Link
                    to="/profile"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    <Avatar name={displayName} size="sm" />
                    <span>{displayName}</span>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => {
                      setIsMenuOpen(false);
                      void logout();
                    }}
                  >
                    <LogOut aria-hidden="true" />
                    {t('layout.logoutButton')}
                  </Button>
                </div>
              )}
            </div>
          </Sheet>
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
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-center text-[10px] font-semibold text-balance text-muted-foreground break-words',
                isActive && 'text-primary',
              )}
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
              <span className="w-full">{label}</span>
            </Link>
          ))}
        </nav>
      )}

      {/* Safe to mount unconditionally here: `Layout` wraps every route, and
          `GuestOnlyRoute` redirects an authenticated user away from
          /login|/register, so this can't appear over the auth screens. A
          freshly registered user always has a name (the backend requires it),
          so there's no register-then-immediately-blocked loop either. */}
      {showSessionControls && !user?.name && <MandatoryNameDialog />}
    </div>
  );
}
