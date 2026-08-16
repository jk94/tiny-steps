import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { listHouseholds } from '../api/household-api';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Badge, Card, EmptyState } from '../components/ui';

/**
 * `['households']` query key — shared with `HouseholdSwitcher` (see
 * `components/HouseholdSwitcher.tsx`) so both read the same cache entry.
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
        <LoadingIndicator />
      ) : !data || data.length === 0 ? (
        <EmptyState title={t('household.list.title')} description={t('household.list.empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((household) => (
            <li key={household.id}>
              <Card>
                <Card.Body className="flex items-center justify-between">
                  <Link
                    to={`/households/${household.id}`}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {household.name}
                  </Link>
                  <Badge>
                    {t(
                      household.role === 'OWNER'
                        ? 'household.list.roleOwner'
                        : 'household.list.roleCoParent',
                    )}
                  </Badge>
                </Card.Body>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
