import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createDiaperEvent } from '../api/diaper-api';
import type { CreateDiaperEventInput } from '../api/diaper-api';
import { mapDiaperError } from '../diaper/mapDiaperError';
import { queryClient } from '../lib/query-client';
import { ErrorMessage } from './ErrorMessage';

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

  const mutation = useMutation({
    mutationFn: (input: CreateDiaperEventInput) => createDiaperEvent(householdId, childId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['households', householdId, 'children', childId, 'diaper-events'],
      });
    },
  });

  const create = (input: CreateDiaperEventInput) => mutation.mutate(input);

  return (
    <section>
      <h2>{t('diaper.quickEntry.title')}</h2>
      <div>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => create({ diaperType: 'PEE' })}
        >
          {t('diaper.quickEntry.peeButton')}
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => create({ diaperType: 'STOOL' })}
        >
          {t('diaper.quickEntry.stoolButton')}
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => create({ diaperType: 'BOTH' })}
        >
          {t('diaper.quickEntry.bothButton')}
        </button>
      </div>

      {mutation.isError && <ErrorMessage message={t(mapDiaperError(mutation.error, 'create'))} />}
    </section>
  );
}
