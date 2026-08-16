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
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link to="/households" className="text-sm font-medium text-primary hover:underline">
        {t('household.detail.backLink')}
      </Link>
      <div>
        <h1 className="text-xl font-bold text-foreground">{data.name}</h1>
        <div className="mt-1 flex gap-3 text-sm text-muted-foreground">
          <span>
            {t('household.detail.yourRoleLabel')}:{' '}
            <strong className="text-foreground">
              {t(
                data.role === 'OWNER' ? 'household.list.roleOwner' : 'household.list.roleCoParent',
              )}
            </strong>
          </span>
          <span>
            {t('household.detail.createdAtLabel')}:{' '}
            <strong className="text-foreground">
              {new Date(data.createdAt).toLocaleDateString()}
            </strong>
          </span>
        </div>
      </div>
      <InviteGenerator householdId={data.id} role={data.role} />
      <ChildList householdId={data.id} role={data.role} />
    </section>
  );
}
