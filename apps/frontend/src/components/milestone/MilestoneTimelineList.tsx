import { Images } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { MilestoneSummary } from '../../api/milestone-api';
import { formatCalendarDate } from '../../lib/calendarDate';
import { childPath } from '../../lib/childAreas';
import { canWrite, ENTRY_WRITE_ROLES, type HouseholdRole } from '../../lib/householdPermissions';
import { milestoneCategoryVisuals } from '../../lib/milestoneCategoryVisuals';
import { viewTransitionStyle } from '../../lib/viewTransition';
import { MilestoneIllustration } from '../illustrations';
import { TransitionLink } from '../TransitionLink';
import { Badge, EmptyState, Skeleton } from '../ui';
import { MilestoneCover } from './MilestoneCover';

export interface MilestoneTimelineListProps {
  householdId: string;
  childId: string;
  /** Already newest-first — the API returns them in timeline order (M-11). */
  milestones: MilestoneSummary[];
  isLoading: boolean;
  /** The signed-in user's role in this household; gates the empty state's call to action. */
  role: HouseholdRole | undefined;
}

/**
 * The milestone timeline (M-11) as an album of tiles: each shows its first
 * photo as a cover (or its category's illustration when it has none), the
 * title, date and age, and its category. A tile opens the milestone's detail
 * screen (`MilestoneDetail`), which holds the note, all photos, who recorded
 * it and the edit/delete actions — the tile itself stays a picture, not a form.
 *
 * Tiles navigate via a view transition: the cover carries the same
 * `view-transition-name` as the detail screen's cover, so it expands into it.
 *
 * Renders the server list verbatim — no `src/offline/` merge the way the event
 * lists do, because milestones are online-only (M-15) and nothing is ever
 * pending locally.
 */
export function MilestoneTimelineList({
  householdId,
  childId,
  milestones,
  isLoading,
  role,
}: MilestoneTimelineListProps) {
  const { t, i18n } = useTranslation();

  if (isLoading) {
    return (
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <li key={index} className="flex flex-col gap-2">
            <Skeleton className="aspect-[4/3] w-full rounded-lg" />
            <Skeleton shape="text" className="h-4 w-3/4" />
            <Skeleton shape="text" className="h-3 w-1/2" />
          </li>
        ))}
      </ul>
    );
  }

  const mayRecord = canWrite(role, ENTRY_WRITE_ROLES);

  if (milestones.length === 0) {
    return (
      <EmptyState
        icon={<MilestoneIllustration className="h-28 w-28" />}
        title={t('milestone.list.empty.title')}
        description={t('milestone.list.empty.description')}
        // A read-only role still learns that nothing has been recorded — it
        // just isn't invited to record something it may not record.
        action={
          mayRecord ? (
            <Link
              to={childPath(householdId, childId, 'milestones/new')}
              className="text-sm font-bold text-primary hover:underline"
            >
              {t('milestone.list.empty.cta')}
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="sr-only">{t('milestone.list.title')}</h2>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {milestones.map((milestone, index) => {
          const visual = milestone.category ? milestoneCategoryVisuals[milestone.category] : null;

          return (
            <li
              key={milestone.id}
              className="animate-rise-in"
              style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
            >
              <TransitionLink
                to={childPath(householdId, childId, `milestones/${milestone.id}`)}
                className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <div className="relative">
                  <MilestoneCover
                    householdId={householdId}
                    childId={childId}
                    milestone={milestone}
                    className="aspect-[4/3] w-full"
                    style={viewTransitionStyle('milestone-cover', milestone.id)}
                  />
                  {visual && (
                    <Badge
                      variant={visual.badgeVariant}
                      size="sm"
                      className="absolute top-2 left-2 shadow-sm"
                    >
                      {t(visual.labelKey)}
                    </Badge>
                  )}
                  {milestone.photos.length > 1 && (
                    <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
                      <Images aria-hidden="true" className="h-3.5 w-3.5" />
                      <span className="sr-only">
                        {t('milestone.list.photoCount', { count: milestone.photos.length })}
                      </span>
                      <span aria-hidden="true">{milestone.photos.length}</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  {/* The stored title, never a re-translation of the
                      template key — see the backend schema comment. */}
                  <p className="line-clamp-2 text-sm leading-snug font-extrabold text-foreground">
                    {milestone.title}
                  </p>
                  <p className="mt-auto text-xs text-muted-foreground">
                    <time dateTime={milestone.achievedAt.slice(0, 10)}>
                      {formatCalendarDate(milestone.achievedAt, i18n.language)}
                    </time>
                    {' · '}
                    {t('milestone.list.ageAtMilestone', {
                      count: milestone.ageInMonthsAtMilestone,
                    })}
                  </p>
                </div>
              </TransitionLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
