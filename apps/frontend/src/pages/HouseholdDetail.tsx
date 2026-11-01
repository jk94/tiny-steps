import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { fetchHousehold } from '../api/household-api';
import { ChildList } from '../components/ChildList';
import { ErrorMessage } from '../components/ErrorMessage';
import { InviteGenerator } from '../components/InviteGenerator';
import { HomeIllustration } from '../components/illustrations';
import { MemberList } from '../components/MemberList';
import { Skeleton } from '../components/ui';
import { householdRoleLabelKey } from '../household/householdRoleLabelKey';
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
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4" aria-hidden="true">
        <Skeleton shape="text" className="h-4 w-24" />
        <div className="flex flex-col gap-2">
          <Skeleton shape="text" className="h-7 w-40" />
          <Skeleton shape="text" className="h-4 w-56" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  if (error || !data) {
    return <ErrorMessage message={t(mapHouseholdError(error))} />;
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Link to="/households" className="text-sm font-bold text-primary hover:underline">
        {t('household.detail.backLink')}
      </Link>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-foreground">{data.name}</h1>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>
              {t('household.detail.yourRoleLabel')}:{' '}
              <strong className="text-foreground">{t(householdRoleLabelKey(data.role))}</strong>
            </span>
            <span>
              {t('household.detail.createdAtLabel')}:{' '}
              <strong className="text-foreground">
                {new Date(data.createdAt).toLocaleDateString()}
              </strong>
            </span>
          </div>
        </div>
        <HomeIllustration className="h-20 w-20" />
      </div>
      {/* Children first: picking a child is what this screen is mostly for. */}
      <ChildList householdId={data.id} role={data.role} />
      <InviteGenerator householdId={data.id} role={data.role} />
      <MemberList householdId={data.id} role={data.role} />
    </section>
  );
}
