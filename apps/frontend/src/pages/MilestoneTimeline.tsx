import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fetchChild } from '../api/child-api';
import { listMilestones, milestonesQueryKey } from '../api/milestone-api';
import { mapChildError } from '../child/mapChildError';
import { ErrorMessage } from '../components/ErrorMessage';
import { MilestoneCatalogView } from '../components/milestone/MilestoneCatalogView';
import { MilestoneTimelineList } from '../components/milestone/MilestoneTimelineList';
import { Skeleton, Tabs } from '../components/ui';

/**
 * Milestone page for one child: the recorded timeline and the template catalog
 * as two tabs of the same screen.
 *
 * The catalog is a tab rather than a route on purpose — it is a second view of
 * the same data (it has to know which templates are already recorded), so
 * splitting it off would mean fetching the milestone list twice.
 *
 * Deliberately does NOT call `useHouseholdRoom`: milestones are online-only
 * with no realtime push (M-15). One recorded on another device shows up on the
 * next visit, which is the right granularity for a handful of entries a year.
 */
export function MilestoneTimeline() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();

  const childQuery = useQuery({
    queryKey: ['households', householdId, 'children', childId],
    queryFn: () => fetchChild(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  const milestonesQuery = useQuery({
    queryKey: milestonesQueryKey(householdId!, childId!),
    queryFn: () => listMilestones(householdId!, childId!),
    retry: false,
    enabled: !!householdId && !!childId,
  });

  if (childQuery.isLoading) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4" aria-hidden="true">
        <Skeleton shape="text" className="h-7 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  if (childQuery.error || !childQuery.data) {
    return <ErrorMessage message={t(mapChildError(childQuery.error))} />;
  }

  const child = childQuery.data;
  const milestones = milestonesQuery.data ?? [];

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <Link
          to={`/households/${householdId}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('milestone.timeline.backLink')}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-foreground">
          {t('milestone.timeline.title', { name: child.name })}
        </h1>
        <p className="text-sm text-muted-foreground">{t('milestone.timeline.subtitle')}</p>
      </div>

      <Link
        to={`/households/${householdId}/children/${childId}/milestones/new`}
        className="text-sm font-medium text-primary hover:underline"
      >
        {t('milestone.timeline.addLink')}
      </Link>

      <Tabs defaultValue="timeline">
        <Tabs.List>
          <Tabs.Tab value="timeline">{t('milestone.timeline.tabTimeline')}</Tabs.Tab>
          <Tabs.Tab value="catalog">{t('milestone.timeline.tabCatalog')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="timeline">
          {milestonesQuery.error ? (
            <ErrorMessage message={t('milestone.validation.loadFailed')} />
          ) : (
            <MilestoneTimelineList
              householdId={householdId!}
              childId={childId!}
              milestones={milestones}
              isLoading={milestonesQuery.isLoading}
            />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="catalog">
          <MilestoneCatalogView
            householdId={householdId!}
            childId={childId!}
            // A failed list query only costs the "already recorded" markers
            // here; the catalog itself is static and still worth showing.
            milestones={milestones}
          />
        </Tabs.Panel>
      </Tabs>
    </section>
  );
}
