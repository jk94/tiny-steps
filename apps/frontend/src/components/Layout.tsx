import { useLayoutEffect, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { useHouseholdRole } from '../household/useHouseholdRole';
import { canWrite, ENTRY_WRITE_ROLES } from '../lib/householdPermissions';
import { isViewTransitionPending, resolvePendingViewTransition } from '../lib/viewTransition';
import { useRealtimeConnection } from '../realtime/useRealtimeConnection';
import { ConnectionStatusDot } from './ConnectionStatusDot';
import { MandatoryNameDialog } from './MandatoryNameDialog';
import { BrandMark } from './navigation/BrandMark';
import { ChildAreasSheet } from './navigation/ChildAreasSheet';
import { ChildBottomNav } from './navigation/ChildBottomNav';
import { ChildSidebarNav } from './navigation/ChildSidebarNav';
import { QuickAddFab } from './navigation/QuickAddFab';
import { useChildNavigation } from './navigation/useChildNavigation';
import { Avatar, Button, Sheet } from './ui';
import { DeFlagIcon, GbFlagIcon } from './ui/icons/flags';
import { cn } from '../lib/cn';

interface GlobalNavItem {
  to: string;
  label: string;
}

/** Shared by the desktop header nav and the mobile sheet, so they can't drift. */
function useGlobalNavItems(): GlobalNavItem[] {
  const { t } = useTranslation();
  return [
    { to: '/households', label: t('nav.householdsLink') },
    { to: '/profile', label: t('nav.profileLink') },
  ];
}

/**
 * The DE/EN pair, rendered in both the desktop header and the mobile sheet.
 * The flags are decorative — each button's translated `aria-label` carries the
 * accessible name, since a flag is a country, not a language. The button
 * matching `currentLanguage` is highlighted (`secondary` variant +
 * `aria-pressed`) so the active language is visible at a glance.
 */
function LanguageButtons({
  currentLanguage,
  onChangeLanguage,
}: {
  currentLanguage: string;
  onChangeLanguage: (language: string) => void;
}) {
  const { t } = useTranslation();
  const isGerman = currentLanguage.startsWith('de');
  const isEnglish = currentLanguage.startsWith('en');
  return (
    <>
      <Button
        type="button"
        variant={isGerman ? 'secondary' : 'ghost'}
        size="sm"
        aria-label={t('language.switchToGerman')}
        aria-pressed={isGerman}
        onClick={() => onChangeLanguage('de')}
      >
        <DeFlagIcon />
      </Button>
      <Button
        type="button"
        variant={isEnglish ? 'secondary' : 'ghost'}
        size="sm"
        aria-label={t('language.switchToEnglish')}
        aria-pressed={isEnglish}
        onClick={() => onChangeLanguage('en')}
      >
        <GbFlagIcon />
      </Button>
    </>
  );
}

/**
 * Wraps one page so it rises in on navigation — unless it was mounted for a
 * view transition, which animates the change itself. Decided once per mount
 * (lazy state), so a later re-render can't restart the animation.
 */
function PageEnter({ children }: { children: ReactNode }) {
  const [enteredViaViewTransition] = useState(isViewTransitionPending);
  return (
    <div
      className="animate-rise-in"
      data-entered-via-view-transition={enteredViaViewTransition || undefined}
    >
      {children}
    </div>
  );
}

/**
 * App shell shared by every route: a top bar (global nav, language switch,
 * connection status, the signed-in user, logout) plus a secondary nav layer
 * for per-child routes — a four-item bottom bar with a "more" sheet and a
 * docked quick-add FAB on mobile, a grouped left sidebar (and a floating FAB)
 * from `lg:` up. That secondary layer only appears once `householdId`/`childId`
 * are both present in the URL; there's no global "current household/child"
 * concept, so household-only or household-less routes (household list,
 * login, …) fall back to just the top bar.
 *
 * Below `lg:` the top bar collapses to brand + connection dot + a hamburger
 * that opens everything else in a right-hand `Sheet`. The dot-only connection
 * indicator stays in the top bar on purpose — it's the one thing worth seeing
 * at a glance without opening a menu — and the sheet repeats it in expanded
 * form (dot + visible label) for anyone who does open it.
 *
 * The shell also completes view transitions (`lib/viewTransition.ts`): its
 * layout effect fires once a new location has been committed, which is the
 * moment the browser may take the "after" snapshot. The persistent chrome
 * (header, bottom bar, FAB, sidebar) carries its own `view-transition-name`,
 * so it stays put while the page content animates.
 */
export function Layout() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { isConnected } = useRealtimeConnection();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { householdId, childId } = useParams<{ householdId?: string; childId?: string }>();
  const globalNavItems = useGlobalNavItems();
  // The mobile sheet shows the signed-in user's name (linking to /profile) at
  // the top instead, so the redundant "Profil" text link is dropped there.
  const sheetNavItems = globalNavItems.filter((item) => item.to !== '/profile');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const hasChildContext = Boolean(householdId && childId);
  const showSessionControls = !isLoading && isAuthenticated && !!user;
  const displayName = user?.name ?? user?.email ?? '';

  const navigation = useChildNavigation(householdId ?? '', childId ?? '', location.pathname);
  const { role } = useHouseholdRole(hasChildContext ? householdId : undefined);
  const showQuickAdd = hasChildContext && canWrite(role, ENTRY_WRITE_ROLES);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useLayoutEffect(() => {
    resolvePendingViewTransition();
  }, [location.key]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-foreground">
      <header
        className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-4 py-2.5 backdrop-blur-md"
        style={{ viewTransitionName: 'app-header' }}
      >
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label={t('nav.brandHome')}>
            <BrandMark />
            <span className="text-lg font-black tracking-tight text-foreground">
              Tiny<span className="text-primary">Steps</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm font-semibold lg:flex">
            {globalNavItems.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="rounded-md px-3 py-1.5 text-foreground hover:bg-muted hover:text-primary"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 lg:flex">
            <LanguageButtons
              currentLanguage={i18n.language}
              onChangeLanguage={(lng) => void i18n.changeLanguage(lng)}
            />
          </div>

          {/* Dot-only, outside both the desktop cluster and the mobile
                sheet, so it stays visible at a glance at every viewport
                width without opening the menu. The sheet repeats it below
                the language buttons, expanded with a visible label. */}
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
            {showSessionControls && (
              <Link
                to="/profile"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <Avatar name={displayName} size="sm" />
                <span>{displayName}</span>
              </Link>
            )}

            <nav className="flex flex-col gap-1 border-t border-border pt-4">
              {sheetNavItems.map(({ to, label }) => (
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
              <LanguageButtons
                currentLanguage={i18n.language}
                onChangeLanguage={(lng) => void i18n.changeLanguage(lng)}
              />
            </div>

            {showSessionControls && (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <ConnectionStatusDot isConnected={isConnected} showLabel />
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

      <div className="flex flex-1 flex-col lg:flex-row">
        {hasChildContext && <ChildSidebarNav navigation={navigation} />}

        <main
          className={cn(
            'min-w-0 flex-1 px-4 pt-4 pb-8 lg:px-8 lg:pt-6',
            hasChildContext && 'pb-28 lg:pb-24',
          )}
        >
          {/* Keyed by path so every navigation replays the short rise-in. */}
          <PageEnter key={location.pathname}>
            <Outlet />
          </PageEnter>
        </main>
      </div>

      {hasChildContext && (
        <>
          <ChildBottomNav
            navigation={navigation}
            hasFab={showQuickAdd}
            onOpenMore={() => setIsMoreOpen(true)}
          />
          <ChildAreasSheet
            navigation={navigation}
            isOpen={isMoreOpen}
            onOpenChange={setIsMoreOpen}
          />
          {showQuickAdd && <QuickAddFab householdId={householdId!} childId={childId!} />}
        </>
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
