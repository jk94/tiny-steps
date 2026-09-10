import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  healthRecordsQueryKey,
  listHealthRecords,
  type HealthRecordSummary,
} from '../../api/health-record-api';
import {
  formatCalendarDate,
  todayAsCalendarDate,
  toCalendarDateInputValue,
} from '../../lib/calendarDate';
import { OVERDUE_BADGE_VARIANT } from '../../lib/healthRecordVisuals';
import { useHouseholdRole } from '../../household/useHouseholdRole';
import { canWrite, ENTRY_WRITE_ROLES } from '../../lib/householdPermissions';
import { Badge, Card, EmptyState, Skeleton } from '../ui';

export interface HealthSummaryCardProps {
  householdId: string;
  childId: string;
}

/** The soonest still-open appointment, or `null` when there is none. */
function findNextDue(records: HealthRecordSummary[]): HealthRecordSummary | null {
  return (
    records
      .filter((record) => record.administeredAt === null && record.dueAt !== null)
      .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))[0] ?? null
  );
}

/**
 * The "Medizin" card on `ChildHome` (MED-13): the next due medication or
 * vaccination, flagged when it is already overdue, plus a link to the full
 * overview.
 *
 * Reuses the health-record list query rather than adding a "next due" endpoint
 * — the overview page fetches the same key, so navigating between the two is
 * free.
 *
 * A failed query renders nothing at all, matching `GrowthSummaryCard` and
 * `MilestoneSummaryCard`: the child overview must not turn into an error page
 * because one optional card could not load — and, more importantly here, an
 * error state must never be shown as "no appointments", which a parent would
 * read as "nothing is due".
 */
export function HealthSummaryCard({ householdId, childId }: HealthSummaryCardProps) {
  const { t, i18n } = useTranslation();
  const { role } = useHouseholdRole(householdId);

  const recordsQuery = useQuery({
    queryKey: healthRecordsQueryKey(householdId, childId),
    queryFn: () => listHealthRecords(householdId, childId),
    retry: false,
  });

  if (recordsQuery.isLoading) {
    return (
      <Card>
        <Card.Body className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton shape="text" className="h-4 w-24" />
          <Skeleton shape="text" className="h-5 w-40" />
        </Card.Body>
      </Card>
    );
  }

  if (recordsQuery.error || !recordsQuery.data) {
    return null;
  }

  const basePath = `/households/${householdId}/children/${childId}/health`;
  const records = recordsQuery.data;
  const nextDue = findNextDue(records);
  const dueDay = nextDue ? toCalendarDateInputValue(nextDue.dueAt!) : null;
  const isOverdue = dueDay !== null && dueDay < todayAsCalendarDate();

  return (
    <Card>
      <Card.Body className="flex flex-col gap-3">
        <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {t('health.card.title')}
        </h2>

        {nextDue ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-foreground">
                {t(isOverdue ? 'health.card.overdue' : 'health.card.nextDue', {
                  name: nextDue.name,
                  date: formatCalendarDate(nextDue.dueAt!, i18n.language),
                })}
              </span>
              {isOverdue && (
                <Badge variant={OVERDUE_BADGE_VARIANT} size="sm">
                  {t('health.row.overdueBadge')}
                </Badge>
              )}
            </div>

            <Link to={basePath} className="text-sm font-medium text-primary hover:underline">
              {t('health.card.link')}
            </Link>
          </>
        ) : records.length > 0 ? (
          // Nothing planned, but there IS a history — saying "nothing recorded
          // yet" here would be plainly false, and the recorded doses are still
          // worth a way in.
          <>
            <span className="text-sm text-muted-foreground">
              {t('health.overview.upcomingEmpty')}
            </span>
            <Link to={basePath} className="text-sm font-medium text-primary hover:underline">
              {t('health.card.link')}
            </Link>
          </>
        ) : (
          <EmptyState
            description={t('health.card.empty')}
            // The "nothing recorded yet" statement stays for every role; only
            // the call to action a read-only role couldn't follow is dropped.
            action={
              canWrite(role, ENTRY_WRITE_ROLES) ? (
                <Link
                  to={`${basePath}/new`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t('health.card.cta')}
                </Link>
              ) : undefined
            }
          />
        )}
      </Card.Body>
    </Card>
  );
}
