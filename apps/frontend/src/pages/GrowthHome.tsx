import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import {
  fetchGrowthReference,
  growthQueryKey,
  growthReferenceQueryKey,
  listGrowthMeasurements,
  type GrowthIndicator,
} from '../api/growth-api';
import { useAuth } from '../auth/useAuth';
import { mapChildError } from '../child/mapChildError';
import { useHouseholdRole } from '../household/useHouseholdRole';
import { canWrite, ENTRY_WRITE_ROLES } from '../lib/householdPermissions';
import { ErrorMessage } from '../components/ErrorMessage';
import { GrowthMeasurementList } from '../components/growth/GrowthMeasurementList';
import { toGrowthSeries } from '../components/growth/growthChartData';
import { Skeleton, Tabs } from '../components/ui';
import { ageInDaysAt } from '../lib/growthAge';
import {
  GROWTH_MEASURES,
  growthMeasureFields,
  growthMeasureVisuals,
  type GrowthMeasure,
} from '../lib/growthMeasureVisuals';

// visx + its d3 dependencies are only needed here, so they load as their own
// async chunk rather than adding to the initial bundle — see ADR-0014.
const GrowthChart = lazy(() => import('../components/growth/GrowthChart'));

/** Which WHO indicator backs each measure's reference bands. */
const MEASURE_INDICATORS: Record<GrowthMeasure, GrowthIndicator> = {
  WEIGHT: 'WEIGHT_FOR_AGE',
  LENGTH: 'LENGTH_OR_HEIGHT_FOR_AGE',
  HEAD_CIRCUMFERENCE: 'HEAD_CIRCUMFERENCE_FOR_AGE',
};

/**
 * The WHO standards are static vendored data, so the reference bands never go
 * stale within a session — refetching them on every tab switch would be pure
 * waste (the endpoint also sets a day of private HTTP caching).
 */
const REFERENCE_STALE_TIME_MS = 24 * 60 * 60 * 1000;

/**
 * Growth trend page for one child.
 *
 * Deliberately does NOT call `useHouseholdRoom`: growth tracking is
 * online-only with no realtime push (W-16). A measurement recorded on another
 * device shows up on the next visit, which is the right granularity for a
 * value that changes a handful of times a year.
 */
export function GrowthHome() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  const { user } = useAuth();
  const { role } = useHouseholdRole(householdId);
  const [measure, setMeasure] = useState<GrowthMeasure>('WEIGHT');

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const measurementsQuery = useQuery({
    queryKey: growthQueryKey(householdId!, childId!),
    queryFn: () => listGrowthMeasurements(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const indicator = MEASURE_INDICATORS[measure];
  const referenceQuery = useQuery({
    queryKey: growthReferenceQueryKey(householdId!, childId!, indicator),
    queryFn: () => fetchGrowthReference(householdId!, childId!, indicator),
    retry: false,
    staleTime: REFERENCE_STALE_TIME_MS,
    enabled: !!householdId && !!childId,
  });

  const measurements = useMemo(() => measurementsQuery.data ?? [], [measurementsQuery.data]);
  const series = useMemo(() => toGrowthSeries(measurements, measure), [measurements, measure]);

  const child = childQuery.data;
  // The axis ends at the child's current age, so a chart of a six-month-old
  // isn't 90% empty five-year-old space.
  const maxAgeDays = useMemo(() => {
    if (!child) {
      return 0;
    }
    const currentAge = ageInDaysAt(new Date(child.birthDate), new Date());
    const oldestMeasurement = series.at(-1)?.ageInDays ?? 0;
    return Math.max(currentAge, oldestMeasurement, 1);
  }, [child, series]);

  const reference = referenceQuery.data ?? null;
  const hasSexOnProfile = child?.sex != null;
  // W-11: an already-recorded measurement falls outside what the reference
  // covers. Scoped to a single measure — growth data is frequently partial
  // (head circumference stops being recorded long before weight/length), so a
  // head-circumference value beyond the reference range must not make the
  // WEIGHT tab claim its own fully-computed data has "no reference".
  const hasOutOfRangeMeasurement = useCallback(
    (candidate: GrowthMeasure) =>
      measurements.some((measurement) => {
        const percentile = measurement.percentiles[growthMeasureFields[candidate].percentileSlot];
        return (
          percentile?.status === 'UNAVAILABLE' &&
          (percentile.reason === 'AGE_ABOVE_REFERENCE_RANGE' ||
            percentile.reason === 'AGE_BELOW_REFERENCE_RANGE')
        );
      }),
    [measurements],
  );

  if (childQuery.isLoading) {
    return (
      <section className="flex flex-col gap-4" aria-hidden="true">
        <Skeleton shape="text" className="h-7 w-48" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-16 w-full" />
      </section>
    );
  }

  if (childQuery.error || !child) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link
          to={`/households/${householdId}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('growth.home.backLink')}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-foreground">
          {t('growth.home.title', { name: child.name })}
        </h1>
        <p className="text-sm text-muted-foreground">{t('growth.home.subtitle')}</p>
      </div>

      <Tabs
        defaultValue={GROWTH_MEASURES[0]}
        value={measure}
        onValueChange={(value) => setMeasure(value as GrowthMeasure)}
      >
        <Tabs.List>
          {GROWTH_MEASURES.map((candidate) => (
            <Tabs.Tab key={candidate} value={candidate}>
              {t(growthMeasureVisuals[candidate].labelKey)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {GROWTH_MEASURES.map((candidate) => (
          <Tabs.Panel key={candidate} value={candidate}>
            {candidate === measure && (
              <div className="flex flex-col gap-3">
                {/* W-10: percentiles are missing for a stated reason, with a
                    direct route to fixing it — never a silent gap. */}
                {!hasSexOnProfile && (
                  <p className="text-sm text-muted-foreground">
                    {t('growth.percentile.unavailable.sexUnknown')}{' '}
                    <Link
                      to={`/households/${householdId}/children/${childId}/settings`}
                      className="font-medium text-primary hover:underline"
                    >
                      {t('growth.percentile.unavailable.sexUnknownLink')}
                    </Link>
                  </p>
                )}
                {hasSexOnProfile && hasOutOfRangeMeasurement(candidate) && (
                  <p className="text-sm text-muted-foreground">
                    {t('growth.chart.noReferenceHint')}
                  </p>
                )}

                {measurementsQuery.isLoading ? (
                  <Skeleton className="h-72 w-full" />
                ) : series.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('growth.chart.empty')}</p>
                ) : (
                  <Suspense fallback={<Skeleton className="h-72 w-full" />}>
                    <GrowthChart
                      measure={candidate}
                      series={series}
                      reference={reference}
                      maxAgeDays={maxAgeDays}
                    />
                  </Suspense>
                )}
              </div>
            )}
          </Tabs.Panel>
        ))}
      </Tabs>

      {/* The chart and the list above stay visible to every role — only the
          invitation to record a new measurement is gated. */}
      {canWrite(role, ENTRY_WRITE_ROLES) && (
        <Link
          to={`/households/${householdId}/children/${childId}/growth/new`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('growth.home.addLink')}
        </Link>
      )}

      {measurementsQuery.error ? (
        <ErrorMessage message={t('growth.validation.loadFailed')} />
      ) : (
        <GrowthMeasurementList
          householdId={householdId!}
          childId={childId!}
          birthDate={child.birthDate}
          measurements={measurements}
          isLoading={measurementsQuery.isLoading}
          role={role}
          currentUserId={user?.id}
        />
      )}
    </section>
  );
}
