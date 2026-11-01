import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { listChildren } from '../api/child-api';
import { formatChildAge } from '../lib/childAge';
import { CHILD_AREAS, childPath } from '../lib/childAreas';
import { childGradientClass } from '../lib/childTheme';
import { cn } from '../lib/cn';
import { canWrite, FULL_WRITE_ROLES, type HouseholdRole } from '../lib/householdPermissions';
import { viewTransitionStyle } from '../lib/viewTransition';
import { ChildPhoto } from './ChildPhoto';
import { BabyIllustration } from './illustrations';
import { LoadingIndicator } from './LoadingIndicator';
import { TransitionLink } from './TransitionLink';
import { EmptyState } from './ui';

export interface ChildListProps {
  householdId: string;
  role: HouseholdRole;
}

const SHORTCUT_AREAS = [CHILD_AREAS.feeding, CHILD_AREAS.sleep, CHILD_AREAS.diaper];

/**
 * Children list within `HouseholdDetail`. "Add child" needs `FULL_WRITE_ROLES`
 * — OWNER *and* CO_PARENT, matching the `@RequireRole(...FULL_WRITE_ROLES)` on
 * `ChildController.create`; it used to be hidden for a CO_PARENT who was in
 * fact allowed to add children. It stays completely hidden, not disabled, for
 * a CAREGIVER/OBSERVER.
 *
 * Each child is a large tile in "its" gradient (`childTheme.ts`) and is the
 * entry point into that child's routes — there's no other UI to pick a
 * "current child". The whole tile opens the child's home dashboard via the
 * "stretched link" pattern (the name `TransitionLink` covers the full tile
 * through an absolutely-positioned `::after`) rather than a tile-level
 * `onClick` — a `<div onClick>` is a mouse/touch-only target with no
 * keyboard/screen-reader equivalent, whereas one real, fully-sized link is
 * reachable both ways. That link runs a view transition: the tile carries the
 * same `view-transition-name` as the child-home hero, so it visibly expands
 * into the overview. The per-type shortcut pills sit above the stretched link
 * (`relative z-10`) so they keep navigating to their own destination
 * (Export/Settings live on the settings page and per-child nav instead, not
 * duplicated here).
 */
export function ChildList({ householdId, role }: ChildListProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['households', householdId, 'children'],
    queryFn: () => listChildren(householdId),
    retry: false,
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-foreground">{t('child.list.title')}</h2>
        {canWrite(role, FULL_WRITE_ROLES) && (
          <Link
            to={`/households/${householdId}/children/new`}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/15"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            {t('child.list.addLink')}
          </Link>
        )}
      </div>
      {isLoading ? (
        <LoadingIndicator />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<BabyIllustration className="h-28 w-28" />}
          description={t('child.list.empty')}
          className="rounded-lg bg-card"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((child, index) => (
            <li
              key={child.id}
              className="animate-rise-in"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div
                className={cn(
                  'group relative isolate overflow-hidden rounded-xl p-4 text-white shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg',
                  childGradientClass(child.id),
                )}
                style={viewTransitionStyle('child', child.id)}
              >
                {/* Decorative bubbles in the tile's corner. */}
                <span
                  aria-hidden="true"
                  className="absolute -top-10 -right-8 -z-10 h-32 w-32 rounded-full bg-white/10"
                />
                <span
                  aria-hidden="true"
                  className="absolute -right-2 -bottom-12 -z-10 h-24 w-24 rounded-full bg-white/10"
                />
                <div className="flex items-center gap-4">
                  <ChildPhoto
                    childId={child.id}
                    householdId={householdId}
                    hasPhoto={child.hasPhoto}
                    name={child.name}
                    size="lg"
                    illustrationFallback
                    className="h-16 w-16 ring-4 ring-white/35"
                    style={viewTransitionStyle('child-avatar', child.id)}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <TransitionLink
                      to={childPath(householdId, child.id)}
                      className="block truncate text-xl font-black after:absolute after:inset-0 after:content-[''] focus-visible:outline-none after:focus-visible:rounded-xl after:focus-visible:ring-4 after:focus-visible:ring-white/70"
                    >
                      {child.name}
                    </TransitionLink>
                    <p className="text-sm font-semibold text-white/85">
                      {formatChildAge(t, child.birthDate)}
                    </p>
                  </div>
                  <ChevronRight
                    aria-hidden="true"
                    className="h-6 w-6 shrink-0 text-white/80 transition-transform group-hover:translate-x-1"
                  />
                </div>
                <div className="relative z-10 mt-4 flex flex-wrap gap-2">
                  {SHORTCUT_AREAS.map((area) => (
                    <Link
                      key={area.key}
                      to={childPath(householdId, child.id, area.segment)}
                      className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/30 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    >
                      <area.Icon aria-hidden="true" className="h-3.5 w-3.5" />
                      {t(area.labelKey)}
                    </Link>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
