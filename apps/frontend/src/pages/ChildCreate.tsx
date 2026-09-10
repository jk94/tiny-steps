import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchHousehold } from '../api/household-api';
import { createChild } from '../api/child-api';
import { ChildForm } from '../components/ChildForm';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { mapHouseholdError } from '../household/mapHouseholdError';
import { canWrite, FULL_WRITE_ROLES } from '../lib/householdPermissions';
import { queryClient } from '../lib/query-client';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

export function ChildCreate() {
  const { t } = useTranslation();
  const { householdId } = useParams<{ householdId: string }>();
  useHouseholdRoom(householdId);
  const navigate = useNavigate();

  const householdQuery = useQuery({
    queryKey: ['households', householdId],
    queryFn: () => fetchHousehold(householdId!),
    retry: false,
    enabled: !!householdId,
  });

  if (householdQuery.isLoading) {
    return <LoadingIndicator />;
  }

  if (householdQuery.error || !householdQuery.data) {
    return <ErrorMessage message={t(mapHouseholdError(householdQuery.error))} />;
  }

  const household = householdQuery.data;

  // Child creation needs `FULL_WRITE_ROLES` server-side
  // (`@RequireRole(...FULL_WRITE_ROLES)` on `ChildController.create`), i.e.
  // OWNER *and* CO_PARENT. This must stay in step with the same check in
  // `ChildList`, which decides whether the "add child" link is shown at all —
  // a stricter guard here would send anyone who follows that link into a dead
  // end. For a CAREGIVER/OBSERVER the link is hidden, so this is reached only
  // by a direct URL visit or a stale-role race (e.g. a second open tab):
  // defense in depth, not the primary UX gate.
  if (!canWrite(household.role, FULL_WRITE_ROLES)) {
    return <ErrorMessage message={t('child.errors.forbidden')} />;
  }

  const handleSubmit = async (formData: FormData) => {
    await createChild(household.id, formData);
    await queryClient.invalidateQueries({ queryKey: ['households', household.id, 'children'] });
    navigate(`/households/${household.id}`, { replace: true });
  };

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <Link
        to={`/households/${household.id}`}
        className="inline-block self-start text-sm font-medium text-primary hover:underline"
      >
        {household.name}
      </Link>
      <h1 className="text-xl font-bold text-foreground">{t('child.create.title')}</h1>
      <ChildForm mode="create" onSubmit={handleSubmit} />
    </section>
  );
}
