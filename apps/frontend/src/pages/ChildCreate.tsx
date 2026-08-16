import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchHousehold } from '../api/household-api';
import { createChild } from '../api/child-api';
import { ChildForm } from '../components/ChildForm';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Card } from '../components/ui';
import { mapHouseholdError } from '../household/mapHouseholdError';
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

  // Child creation is OWNER-only server-side (see `ChildController`). The
  // "add child" link that leads here is already hidden for a CO_PARENT
  // (see `ChildList`), so this is only reachable by a direct URL visit or a
  // stale-role race (e.g. a second open tab) — defense in depth, not the
  // primary UX gate.
  if (household.role !== 'OWNER') {
    return <ErrorMessage message={t('child.errors.forbidden')} />;
  }

  const handleSubmit = async (formData: FormData) => {
    await createChild(household.id, formData);
    await queryClient.invalidateQueries({ queryKey: ['households', household.id, 'children'] });
    navigate(`/households/${household.id}`, { replace: true });
  };

  return (
    <section className="mx-auto w-full max-w-sm">
      <Link
        to={`/households/${household.id}`}
        className="mb-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        {household.name}
      </Link>
      <Card>
        <Card.Body className="flex flex-col gap-4">
          <h1 className="text-xl font-bold text-foreground">{t('child.create.title')}</h1>
          <ChildForm mode="create" onSubmit={handleSubmit} />
        </Card.Body>
      </Card>
    </section>
  );
}
