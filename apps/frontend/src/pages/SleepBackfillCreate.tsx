import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { createSleepEventOptimistic } from '../api/sleep-api';
import { useAuth } from '../auth/useAuth';
import { SleepEventForm } from '../components/SleepEventForm';
import type { SleepEventFormOutput } from '../components/SleepEventForm';
import { queryClient } from '../lib/query-client';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

/** Manual backfill create page — wraps `SleepEventForm` in create mode. */
export function SleepBackfillCreate() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  useHouseholdRoom(householdId);
  const navigate = useNavigate();

  const handleSubmit = async (output: SleepEventFormOutput) => {
    // `user` is always non-null here — this page only renders behind `ProtectedRoute`.
    await createSleepEventOptimistic(householdId!, childId!, user!.id, output);
    await queryClient.invalidateQueries({
      queryKey: ['households', householdId, 'children', childId, 'sleep-events'],
    });
    navigate(`/households/${householdId}/children/${childId}/sleep`, { replace: true });
  };

  return (
    <section>
      <Link to={`/households/${householdId}/children/${childId}/sleep`}>
        {t('sleep.backfill.backLink')}
      </Link>
      <h1>{t('sleep.backfill.title')}</h1>
      <SleepEventForm mode="create" onSubmit={handleSubmit} />
    </section>
  );
}
