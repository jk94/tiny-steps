import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import type { ChildNavigation, ChildNavLink } from './useChildNavigation';

function SidebarLink({ link }: { link: ChildNavLink }) {
  return (
    <Link
      to={link.to}
      aria-current={link.isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        link.isActive && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
          link.area ? cn(link.area.tint, link.area.ink) : 'bg-muted text-foreground',
        )}
      >
        <link.Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      {link.label}
    </Link>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <p className="mt-4 mb-1 px-2 text-[0.6875rem] font-extrabold tracking-wider text-muted-foreground/80 uppercase">
      {children}
    </p>
  );
}

/**
 * Desktop per-child navigation. There is room for every destination here, so
 * nothing hides behind "more"; the areas are grouped into everyday care and
 * growing up, each with its area-colored icon chip.
 */
export function ChildSidebarNav({ navigation }: { navigation: ChildNavigation }) {
  const { t } = useTranslation();
  const { areas } = navigation;

  return (
    <aside
      className="hidden lg:flex lg:w-60 lg:flex-none lg:flex-col lg:border-r lg:border-border/70 lg:bg-background/60 lg:p-4"
      style={{ viewTransitionName: 'app-sidebar' }}
    >
      <nav aria-label={t('nav.childNavLabel')} className="flex flex-col gap-0.5">
        <SidebarLink link={navigation.overview} />
        <SidebarLink link={navigation.timeline} />
        <SectionHeading>{t('nav.child.sectionDaily')}</SectionHeading>
        <SidebarLink link={areas.feeding} />
        <SidebarLink link={areas.sleep} />
        <SidebarLink link={areas.diaper} />
        <SectionHeading>{t('nav.child.sectionGrowingUp')}</SectionHeading>
        <SidebarLink link={areas.growth} />
        <SidebarLink link={areas.milestones} />
        <SidebarLink link={areas.development} />
        <SidebarLink link={areas.health} />
        <div className="mt-4 border-t border-border/70 pt-4">
          <SidebarLink link={navigation.settings} />
        </div>
      </nav>
    </aside>
  );
}
