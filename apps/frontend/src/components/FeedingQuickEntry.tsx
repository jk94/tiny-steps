import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createFeedingEvent } from '../api/feeding-api';
import type { CreateFeedingEventInput } from '../api/feeding-api';
import { mapFeedingError } from '../feeding/mapFeedingError';
import { queryClient } from '../lib/query-client';
import { ErrorMessage } from './ErrorMessage';

const BOTTLE_AMOUNT_PRESETS_ML = [60, 90, 120, 150];

export interface FeedingQuickEntryProps {
  householdId: string;
  childId: string;
}

/**
 * One-tap quick-entry button grid, per the plan's tap-count targets:
 *  - breastfeeding left/right: 1 tap (server defaults times, starts a
 *    running timer — see `CreateFeedingEventDto`'s server-side precedence).
 *  - solid: 1 tap.
 *  - bottle: 2 taps (reveal ml presets, then pick one).
 *
 * A successful create invalidates the `active-timer` and feeding-events
 * list queries so `FeedingHome` immediately swaps to `<FeedingTimer>` (for
 * BREAST) or the updated list (for BOTTLE/SOLID) reflects the new entry.
 */
export function FeedingQuickEntry({ householdId, childId }: FeedingQuickEntryProps) {
  const { t } = useTranslation();
  const [showBottlePresets, setShowBottlePresets] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: CreateFeedingEventInput) => createFeedingEvent(householdId, childId, input),
    onSuccess: async () => {
      setShowBottlePresets(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['households', householdId, 'children', childId, 'feeding-events'],
        }),
      ]);
    },
  });

  const create = (input: CreateFeedingEventInput) => mutation.mutate(input);

  return (
    <section>
      <h2>{t('feeding.quickEntry.title')}</h2>
      <div>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => create({ feedingType: 'BREAST', side: 'LEFT' })}
        >
          {t('feeding.quickEntry.breastLeftButton')}
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => create({ feedingType: 'BREAST', side: 'RIGHT' })}
        >
          {t('feeding.quickEntry.breastRightButton')}
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => setShowBottlePresets(true)}
        >
          {t('feeding.quickEntry.bottleButton')}
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => create({ feedingType: 'SOLID' })}
        >
          {t('feeding.quickEntry.solidButton')}
        </button>
      </div>

      {showBottlePresets && (
        <div>
          {BOTTLE_AMOUNT_PRESETS_ML.map((amountMl) => (
            <button
              key={amountMl}
              type="button"
              disabled={mutation.isPending}
              onClick={() => create({ feedingType: 'BOTTLE', amountMl })}
            >
              {t('feeding.quickEntry.bottleAmountButton', { amount: amountMl })}
            </button>
          ))}
        </div>
      )}

      {mutation.isError && <ErrorMessage message={t(mapFeedingError(mutation.error, 'create'))} />}
    </section>
  );
}
