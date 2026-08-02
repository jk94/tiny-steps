import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { createFeedingEvent } from '../api/feeding-api';
import { FeedingEventForm } from '../components/FeedingEventForm';
import type { FeedingEventFormOutput } from '../components/FeedingEventForm';
import { queryClient } from '../lib/query-client';

/** Manual backfill create page — wraps `FeedingEventForm` in create mode. */
export function FeedingBackfillCreate() {
  const { t } = useTranslation();
  const { householdId, childId } = useParams<{ householdId: string; childId: string }>();
  const navigate = useNavigate();

  const handleSubmit = async (output: FeedingEventFormOutput) => {
    // `FeedingEventFormOutput.note` is `string | null | undefined` because
    // the same output type is shared with edit mode, but this page only
    // ever renders the form in `mode="create"`, which never actually
    // produces `null` (see `FeedingEventForm`) — normalize the type here
    // to match `CreateFeedingEventInput.note` (`string | undefined`).
    await createFeedingEvent(householdId!, childId!, { ...output, note: output.note ?? undefined });
    await queryClient.invalidateQueries({
      queryKey: ['households', householdId, 'children', childId, 'feeding-events'],
    });
    navigate(`/households/${householdId}/children/${childId}/feeding`, { replace: true });
  };

  return (
    <section>
      <Link to={`/households/${householdId}/children/${childId}/feeding`}>
        {t('feeding.backfill.backLink')}
      </Link>
      <h1>{t('feeding.backfill.title')}</h1>
      <FeedingEventForm mode="create" onSubmit={handleSubmit} />
    </section>
  );
}
