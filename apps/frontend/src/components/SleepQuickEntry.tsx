import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createSleepEventOptimistic } from '../api/sleep-api';
import { useAuth } from '../auth/useAuth';
import { mapSleepError } from '../sleep/mapSleepError';
import { queryClient } from '../lib/query-client';
import { ErrorMessage } from './ErrorMessage';

export interface SleepQuickEntryProps {
  householdId: string;
  childId: string;
}

/**
 * One-tap quick-entry button that starts a running sleep timer (server
 * defaults `startedAt`/`occurredAt` to now — see `CreateSleepEventDto`'s
 * server-side precedence in `SleepService.create`). Kept as its own small
 * component (not folded into `SleepHome`) for structural parity with
 * `FeedingQuickEntry` and independent testability, even though Sleep has
 * only one button (no bottle/solid/side variants to branch on).
 *
 * A successful create invalidates the `active-timer`/sleep-events query
 * prefix so `SleepHome` immediately swaps to `<SleepTimer>`.
 */
export function SleepQuickEntry({ householdId, childId }: SleepQuickEntryProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const mutation = useMutation({
    // `user` is always non-null here — this component only renders behind `ProtectedRoute`.
    mutationFn: () => createSleepEventOptimistic(householdId, childId, user!.id, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['households', householdId, 'children', childId, 'sleep-events'],
      });
    },
  });

  return (
    <section>
      <h2>{t('sleep.quickEntry.title')}</h2>
      <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        {t('sleep.quickEntry.startButton')}
      </button>

      {mutation.isError && <ErrorMessage message={t(mapSleepError(mutation.error, 'create'))} />}
    </section>
  );
}
