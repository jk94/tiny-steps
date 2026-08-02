import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fetchHousehold } from '../api/household-api';
import { ChildList } from '../components/ChildList';
import { ErrorMessage } from '../components/ErrorMessage';
import { InviteGenerator } from '../components/InviteGenerator';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { mapHouseholdError } from '../household/mapHouseholdError';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

export function HouseholdDetail() {
  const { t } = useTranslation();
  const { householdId } = useParams<{ householdId: string }>();
  useHouseholdRoom(householdId);
  const { data, isLoading, error } = useQuery({
    queryKey: ['households', householdId],
    queryFn: () => fetchHousehold(householdId!),
    retry: false,
    enabled: !!householdId,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (error || !data) {
    return <ErrorMessage message={t(mapHouseholdError(error))} />;
  }

  return (
    <section>
      <Link to="/households">{t('household.detail.backLink')}</Link>
      <h1>{data.name}</h1>
      <p>
        {t('household.detail.yourRoleLabel')}:{' '}
        <strong>
          {t(data.role === 'OWNER' ? 'household.list.roleOwner' : 'household.list.roleCoParent')}
        </strong>
      </p>
      <p>
        {t('household.detail.createdAtLabel')}:{' '}
        <strong>{new Date(data.createdAt).toLocaleDateString()}</strong>
      </p>
      <InviteGenerator householdId={data.id} role={data.role} />
      <ChildList householdId={data.id} role={data.role} />
    </section>
  );
}
