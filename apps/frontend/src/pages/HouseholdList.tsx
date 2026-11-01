import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { listHouseholds } from '../api/household-api';
import { HomeIllustration } from '../components/illustrations';
import { Badge, Card, EmptyState, Skeleton } from '../components/ui';
import { householdRoleLabelKey } from '../household/householdRoleLabelKey';

/**
 * `['households']` query key — also invalidated by `HouseholdCreate`,
 * `InviteAccept` and `RealtimeProvider`, so this list picks up a newly
 * created/joined household without waiting for an unrelated refetch.
 */
const HOUSEHOLDS_QUERY_KEY = ['households'] as const;

export function HouseholdList() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: HOUSEHOLDS_QUERY_KEY,
    queryFn: listHouseholds,
    retry: false,
  });

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="relative flex items-center gap-4 overflow-hidden rounded-xl bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-primary)_14%,var(--color-card)),var(--color-card))] p-5 shadow-sm">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
          <h1 className="text-2xl font-black text-foreground">{t('household.list.title')}</h1>
          <Link
            to="/households/new"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            {t('household.list.createLink')}
          </Link>
        </div>
        <HomeIllustration className="h-24 w-24" />
      </div>

      {isLoading ? (
        <ul className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Card>
                <Card.Body className="flex items-center justify-between gap-3 p-4">
                  <Skeleton shape="text" className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </Card.Body>
              </Card>
            </li>
          ))}
        </ul>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<HomeIllustration className="h-28 w-28" />}
          title={t('household.list.title')}
          description={t('household.list.empty')}
          className="rounded-lg bg-card"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((household, index) => (
            <li
              key={household.id}
              className="animate-rise-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <Card className="transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <Card.Body className="p-0">
                  <Link
                    to={`/households/${household.id}`}
                    aria-label={household.name}
                    className="group flex items-center gap-3 p-3 pr-4"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-lg font-black text-primary"
                    >
                      {household.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span aria-hidden="true" className="flex-1 font-bold text-foreground">
                      {household.name}
                    </span>
                    <Badge>{t(householdRoleLabelKey(household.role))}</Badge>
                    <ChevronRight
                      aria-hidden="true"
                      className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </Card.Body>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
