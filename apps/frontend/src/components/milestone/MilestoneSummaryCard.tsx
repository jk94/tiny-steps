import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { listMilestones, milestonesQueryKey } from '../../api/milestone-api';
import { formatCalendarDate } from '../../lib/calendarDate';
import { milestoneCategoryVisuals } from '../../lib/milestoneCategoryVisuals';
import { useHouseholdRole } from '../../household/useHouseholdRole';
import { canWrite, ENTRY_WRITE_ROLES } from '../../lib/householdPermissions';
import { MilestoneIllustration } from '../illustrations';
import { Badge, Card, EmptyState, Skeleton } from '../ui';
import { MilestoneCover } from './MilestoneCover';
import { AreaCardHeading } from '../AreaCardHeading';
import { CHILD_AREAS } from '../../lib/childAreas';

export interface MilestoneSummaryCardProps {
  householdId: string;
  childId: string;
}

/**
 * The "Meilensteine" card on `ChildHome` (M-13): the most recently recorded
 * milestone with its date and the child's age at the time, plus a link to the
 * full timeline.
 *
 * Reuses the milestone list query rather than adding a "latest" endpoint — the
 * timeline page fetches the same key, so navigating between the two is free.
 * A failed query renders nothing at all, matching `GrowthSummaryCard` and
 * `TimeSinceSection`: the child overview must not turn into an error page
 * because one optional card could not load.
 */
export function MilestoneSummaryCard({ householdId, childId }: MilestoneSummaryCardProps) {
  const { t, i18n } = useTranslation();
  const { role } = useHouseholdRole(householdId);

  const milestonesQuery = useQuery({
    queryKey: milestonesQueryKey(householdId, childId),
    queryFn: () => listMilestones(householdId, childId),
    retry: false,
  });

  if (milestonesQuery.isLoading) {
    return (
      <Card>
        <Card.Body className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton shape="text" className="h-4 w-24" />
          <Skeleton shape="text" className="h-5 w-40" />
        </Card.Body>
      </Card>
    );
  }

  if (milestonesQuery.error || !milestonesQuery.data) {
    return null;
  }

  const milestonePath = `/households/${householdId}/children/${childId}/milestones`;
  // The API returns milestones newest-first (M-11), so the latest is first.
  const latest = milestonesQuery.data[0];
  const visual = latest?.category ? milestoneCategoryVisuals[latest.category] : null;

  return (
    <Card>
      <Card.Body className="flex flex-col gap-3">
        <AreaCardHeading area={CHILD_AREAS.milestones}>{t('milestone.card.title')}</AreaCardHeading>

        {latest ? (
          <>
            <div className="flex items-center gap-3">
              <MilestoneCover
                householdId={householdId}
                childId={childId}
                milestone={latest}
                className="h-16 w-16 shrink-0 rounded-md"
                illustrationClassName="h-full w-full"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-bold text-foreground">{latest.title}</span>
                  {visual && (
                    <Badge variant={visual.badgeVariant} size="sm">
                      {t(visual.labelKey)}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="text-sm text-muted-foreground">
                    {t('milestone.card.achievedOn', {
                      date: formatCalendarDate(latest.achievedAt, i18n.language),
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('milestone.card.ageAt', { count: latest.ageInMonthsAtMilestone })}
                  </span>
                </div>
              </div>
            </div>

            <Link to={milestonePath} className="text-sm font-bold text-primary hover:underline">
              {t('milestone.card.link')}
            </Link>
          </>
        ) : (
          <EmptyState
            icon={<MilestoneIllustration className="h-20 w-20" />}
            className="py-4"
            description={t('milestone.card.empty')}
            // The "nothing recorded yet" statement stays for every role; only
            // the call to action a read-only role couldn't follow is dropped.
            action={
              canWrite(role, ENTRY_WRITE_ROLES) ? (
                <Link
                  to={`${milestonePath}/new`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t('milestone.card.cta')}
                </Link>
              ) : undefined
            }
          />
        )}
      </Card.Body>
    </Card>
  );
}
