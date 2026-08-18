import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { listHouseholds } from '../api/household-api';
import { Select } from './ui';

const HOUSEHOLDS_QUERY_KEY = ['households'] as const;

/**
 * Header dropdown for jumping straight to a household's detail page. Shares
 * the `['households']` query key with `HouseholdList` so both read the same
 * cache entry — no duplicate fetch just because both happen to be mounted
 * (e.g. `Layout` + `/households`).
 *
 * A one-shot navigation trigger, not persistent state: selecting an option
 * navigates and the control resets to its placeholder — there's no global
 * "current household" concept anywhere in the app. That reset is what the
 * pinned `value=""` achieves: no item carries the empty value, and the
 * primitive shows the placeholder for it.
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
    <div className="[&_label]:sr-only">
      <Select
        label={t('household.switcher.label')}
        placeholder={t('household.switcher.placeholder')}
        value=""
        onValueChange={(householdId) => void navigate(`/households/${householdId}`)}
        className="h-9 w-44"
      >
        {data.map((household) => (
          <Select.Item key={household.id} value={household.id}>
            {household.name}
          </Select.Item>
        ))}
      </Select>
    </div>
  );
}
