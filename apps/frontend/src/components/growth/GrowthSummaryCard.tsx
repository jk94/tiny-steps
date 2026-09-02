import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  growthQueryKey,
  listGrowthMeasurements,
  type GrowthMeasurementSummary,
} from '../../api/growth-api';
import { ageInMonths } from '../../lib/childAge';
import { formatCalendarDate, parseCalendarDate } from '../../lib/calendarDate';
import { GROWTH_MEASURES } from '../../lib/growthMeasureVisuals';
import { Card, EmptyState, Skeleton } from '../ui';
import { GrowthMeasureValueRow } from './GrowthMeasureValueRow';

export interface GrowthSummaryCardProps {
  householdId: string;
  childId: string;
  /** ISO birth date, used to state the child's age at the measurement (W-15). */
  birthDate: string;
}

/**
 * The "Wachstum" card on `ChildHome` (W-15): the most recent measurement with
 * its values, percentiles and the child's age at the time, plus a link to the
 * full trend.
 *
 * Reuses the growth list query rather than adding a "latest" endpoint — the
 * growth page fetches the same key, so navigating between the two is free.
 * A failed query renders nothing at all, matching `TimeSinceSection`: the
 * child overview must not turn into an error page because one optional card
 * could not load.
 */
export function GrowthSummaryCard({ householdId, childId, birthDate }: GrowthSummaryCardProps) {
  const { t, i18n } = useTranslation();

  const measurementsQuery = useQuery({
    queryKey: growthQueryKey(householdId, childId),
    queryFn: () => listGrowthMeasurements(householdId, childId),
    retry: false,
  });

  if (measurementsQuery.isLoading) {
    return (
      <Card>
        <Card.Body className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton shape="text" className="h-4 w-24" />
          <Skeleton shape="text" className="h-5 w-40" />
        </Card.Body>
      </Card>
    );
  }

  if (measurementsQuery.error || !measurementsQuery.data) {
    return null;
  }

  const growthPath = `/households/${householdId}/children/${childId}/growth`;
  // The API returns measurements oldest-first for the chart, so the newest is
  // the last element.
  const latest: GrowthMeasurementSummary | undefined = measurementsQuery.data.at(-1);

  return (
    <Card>
      <Card.Body className="flex flex-col gap-3">
        <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {t('growth.card.title')}
        </h2>

        {latest ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {t('growth.card.measuredOn', {
                  date: formatCalendarDate(latest.measuredAt, i18n.language),
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('growth.list.ageAtMeasurement', {
                  count: ageInMonths(birthDate, parseCalendarDate(latest.measuredAt) ?? new Date()),
                })}
              </span>
            </div>

            <ul className="flex flex-col gap-1">
              {GROWTH_MEASURES.map((measure) => (
                <GrowthMeasureValueRow key={measure} measure={measure} measurement={latest} />
              ))}
            </ul>

            <Link to={growthPath} className="text-sm font-medium text-primary hover:underline">
              {t('growth.card.link')}
            </Link>
          </>
        ) : (
          <EmptyState
            description={t('growth.card.empty')}
            action={
              <Link
                to={`${growthPath}/new`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {t('growth.card.cta')}
              </Link>
            }
          />
        )}
      </Card.Body>
    </Card>
  );
}
