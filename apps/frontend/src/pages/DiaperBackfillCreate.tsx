import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { createDiaperEvent } from '../api/diaper-api';
import { DiaperEventForm } from '../components/DiaperEventForm';
import type { DiaperEventFormOutput } from '../components/DiaperEventForm';
import { queryClient } from '../lib/query-client';

/** Manual backfill create page — wraps `DiaperEventForm` in create mode. */
export function DiaperBackfillCreate() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  const navigate = useNavigate();

  const handleSubmit = async (output: DiaperEventFormOutput) => {
    // `DiaperEventFormOutput.note` is `string | null | undefined` because
    // the same output type is shared with edit mode, but this page only
    // ever renders the form in `mode="create"`, which never actually
    // produces `null` (see `DiaperEventForm`) — normalize the type here
    // to match `CreateDiaperEventInput.note` (`string | undefined`).
    await createDiaperEvent(householdId!, childId!, { ...output, note: output.note ?? undefined });
    await queryClient.invalidateQueries({
      queryKey: ['households', householdId, 'children', childId, 'diaper-events'],
    });
    navigate(`/households/${householdId}/children/${childId}/diaper`, { replace: true });
  };

  return (
    <section>
      <Link to={`/households/${householdId}/children/${childId}/diaper`}>
        {t('diaper.backfill.backLink')}
      </Link>
      <h1>{t('diaper.backfill.title')}</h1>
      <DiaperEventForm mode="create" onSubmit={handleSubmit} />
    </section>
  );
}
