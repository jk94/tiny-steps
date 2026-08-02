import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { createSleepEvent } from '../api/sleep-api';
import { SleepEventForm } from '../components/SleepEventForm';
import type { SleepEventFormOutput } from '../components/SleepEventForm';
import { queryClient } from '../lib/query-client';
import { useHouseholdRoom } from '../realtime/useHouseholdRoom';

/** Manual backfill create page — wraps `SleepEventForm` in create mode. */
export function SleepBackfillCreate() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  useHouseholdRoom(householdId);
  const navigate = useNavigate();

  const handleSubmit = async (output: SleepEventFormOutput) => {
    await createSleepEvent(householdId!, childId!, output);
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
