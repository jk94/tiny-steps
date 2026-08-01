import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { listHouseholds } from '../api/household-api';
import { LoadingIndicator } from '../components/LoadingIndicator';

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
    <section>
      <h1>{t('household.list.title')}</h1>
      <Link to="/households/new">{t('household.list.createLink')}</Link>

      {isLoading ? (
        <LoadingIndicator />
      ) : !data || data.length === 0 ? (
        <p>{t('household.list.empty')}</p>
      ) : (
        <ul>
          {data.map((household) => (
            <li key={household.id}>
              <Link to={`/households/${household.id}`}>{household.name}</Link>
              <span>
                {t(
                  household.role === 'OWNER'
                    ? 'household.list.roleOwner'
                    : 'household.list.roleCoParent',
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
