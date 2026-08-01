import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { listHouseholds } from '../api/household-api';

const HOUSEHOLDS_QUERY_KEY = ['households'] as const;

/**
 * Header dropdown for jumping straight to a household's detail page. Shares
 * the `['households']` query key with `HouseholdList` so both read the same
 * cache entry — no duplicate fetch just because both happen to be mounted
 * (e.g. `Layout` + `/households`).
 *
 * A one-shot navigation trigger, not persistent state: selecting an option
 * navigates and the `<select>` resets to its placeholder — there's no
 * global "current household" concept anywhere in the app.
 */
export function HouseholdSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: HOUSEHOLDS_QUERY_KEY,
    queryFn: listHouseholds,
    retry: false,
  });

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <select
      aria-label={t('household.switcher.label')}
      value=""
      onChange={(event) => navigate(`/households/${event.target.value}`)}
    >
      <option value="" disabled>
        {t('household.switcher.placeholder')}
      </option>
      {data.map((household) => (
        <option key={household.id} value={household.id}>
          {household.name}
        </option>
      ))}
    </select>
  );
}
