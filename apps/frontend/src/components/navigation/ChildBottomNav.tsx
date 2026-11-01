import { LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import type { ChildNavigation, ChildNavLink } from './useChildNavigation';

const ITEM_CLASS =
  'group flex min-w-0 flex-col items-center gap-1 px-1 pt-2 pb-1.5 text-[0.6875rem] font-bold text-muted-foreground transition-colors focus-visible:outline-none';
const INDICATOR_CLASS =
  'flex h-7 w-14 items-center justify-center rounded-full transition-colors group-hover:bg-muted group-focus-visible:ring-2 group-focus-visible:ring-ring';

function NavItem({ link }: { link: ChildNavLink }) {
  return (
    <Link
      to={link.to}
      aria-current={link.isActive ? 'page' : undefined}
      className={cn(ITEM_CLASS, link.isActive && 'text-primary')}
    >
      <span
        className={cn(INDICATOR_CLASS, link.isActive && 'bg-primary/15 group-hover:bg-primary/15')}
      >
        <link.Icon aria-hidden="true" className="h-5 w-5" strokeWidth={link.isActive ? 2.5 : 2} />
      </span>
      <span className="w-full truncate text-center">{link.label}</span>
    </Link>
  );
}

export interface ChildBottomNavProps {
  navigation: ChildNavigation;
  /** Leaves the middle slot free for the docked floating action button. */
  hasFab: boolean;
  onOpenMore: () => void;
}

/**
 * Mobile per-child navigation: four destinations instead of the former eight —
 * overview, timeline, milestones and a "more" tab that opens a sheet with every
 * other area. When the user may log entries, the middle slot stays empty for
 * the quick-add FAB, which is docked over it (`QuickAddFab`).
 *
 * Feeding, sleep and diaper moved behind "more" deliberately: their everyday
 * actions are one tap away on the FAB, and their latest state is a tile on the
 * overview, so the bar only needs the screens one *browses*.
 */
export function ChildBottomNav({ navigation, hasFab, onOpenMore }: ChildBottomNavProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('nav.childNavLabel')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      style={{ viewTransitionName: 'app-bottom-nav' }}
    >
      <div className={cn('mx-auto grid max-w-lg', hasFab ? 'grid-cols-5' : 'grid-cols-4')}>
        <NavItem link={navigation.overview} />
        <NavItem link={navigation.timeline} />
        {hasFab && <span aria-hidden="true" />}
        <NavItem link={navigation.areas.milestones} />
        <button
          type="button"
          onClick={onOpenMore}
          aria-haspopup="dialog"
          className={cn(ITEM_CLASS, navigation.isInMoreSection && 'text-primary')}
        >
          <span
            className={cn(
              INDICATOR_CLASS,
              navigation.isInMoreSection && 'bg-primary/15 group-hover:bg-primary/15',
            )}
          >
            <LayoutGrid aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="w-full truncate text-center">{t('nav.child.more')}</span>
        </button>
      </div>
    </nav>
  );
}
