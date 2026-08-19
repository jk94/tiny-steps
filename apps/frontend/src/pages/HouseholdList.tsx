import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { listHouseholds } from '../api/household-api';
import { Badge, Card, EmptyState, Skeleton } from '../components/ui';

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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">{t('household.list.title')}</h1>
        <Link
          to="/households/new"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('household.list.createLink')}
        </Link>
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
        <EmptyState title={t('household.list.title')} description={t('household.list.empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((household) => (
            <li key={household.id}>
              <Card>
                <Card.Body className="p-0">
                  <Link
                    to={`/households/${household.id}`}
                    aria-label={household.name}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50"
                  >
                    <span aria-hidden="true" className="font-semibold text-foreground">
                      {household.name}
                    </span>
                    <Badge>
                      {t(
                        household.role === 'OWNER'
                          ? 'household.list.roleOwner'
                          : 'household.list.roleCoParent',
                      )}
                    </Badge>
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
