import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createDiaperEventOptimistic } from '../api/diaper-api';
import type { CreateDiaperEventInput } from '../api/diaper-api';
import { useAuth } from '../auth/useAuth';
import { mapDiaperError } from '../diaper/mapDiaperError';
import { queryClient } from '../lib/query-client';
import { ErrorMessage } from './ErrorMessage';
import { Button } from './ui';

export interface DiaperQuickEntryProps {
  householdId: string;
  childId: string;
}

/**
 * Three always-visible quick-entry buttons, each exactly 1 tap — no
 * reveal/expand step, unlike `FeedingQuickEntry`'s bottle-preset flow.
 * Diaper is never timer-based, so there's no timer/quick-entry branch to
 * pick between here (unlike `FeedingHome`/`SleepHome`) — `DiaperHome`
 * renders this unconditionally.
 *
 * A successful create invalidates the diaper-events list query so
 * `DiaperEventList` immediately reflects the new entry.
 */
export function DiaperQuickEntry({ householdId, childId }: DiaperQuickEntryProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const mutation = useMutation({
    // `user` is always non-null here — this component only renders behind `ProtectedRoute`.
    mutationFn: (input: CreateDiaperEventInput) =>
      createDiaperEventOptimistic(householdId, childId, user!.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['households', householdId, 'children', childId, 'diaper-events'],
      });
    },
  });

  const create = (input: CreateDiaperEventInput) => mutation.mutate(input);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {t('diaper.quickEntry.title')}
      </h2>
      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-14"
          disabled={mutation.isPending}
          onClick={() => create({ diaperType: 'PEE' })}
        >
          {t('diaper.quickEntry.peeButton')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-14"
          disabled={mutation.isPending}
          onClick={() => create({ diaperType: 'STOOL' })}
        >
          {t('diaper.quickEntry.stoolButton')}
        </Button>
        <Button
          type="button"
          variant="primary"
          className="h-14"
          disabled={mutation.isPending}
          onClick={() => create({ diaperType: 'BOTH' })}
        >
          {t('diaper.quickEntry.bothButton')}
        </Button>
      </div>

      {mutation.isError && <ErrorMessage message={t(mapDiaperError(mutation.error, 'create'))} />}
    </section>
  );
}
