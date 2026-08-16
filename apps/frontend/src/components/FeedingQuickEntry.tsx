import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createFeedingEventOptimistic } from '../api/feeding-api';
import type { CreateFeedingEventInput } from '../api/feeding-api';
import { useAuth } from '../auth/useAuth';
import { mapFeedingError } from '../feeding/mapFeedingError';
import { queryClient } from '../lib/query-client';
import { ErrorMessage } from './ErrorMessage';
import { Badge, Button } from './ui';

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
  const { user } = useAuth();
  const [showBottlePresets, setShowBottlePresets] = useState(false);

  const mutation = useMutation({
    // `user` is always non-null here — this component only renders behind `ProtectedRoute`.
    mutationFn: (input: CreateFeedingEventInput) =>
      createFeedingEventOptimistic(householdId, childId, user!.id, input),
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
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {t('feeding.quickEntry.title')}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-14"
          disabled={mutation.isPending}
          onClick={() => create({ feedingType: 'BREAST', side: 'LEFT' })}
        >
          {t('feeding.quickEntry.breastLeftButton')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-14"
          disabled={mutation.isPending}
          onClick={() => create({ feedingType: 'BREAST', side: 'RIGHT' })}
        >
          {t('feeding.quickEntry.breastRightButton')}
        </Button>
        <Button
          type="button"
          variant="primary"
          className="h-14"
          disabled={mutation.isPending}
          onClick={() => setShowBottlePresets(true)}
        >
          {t('feeding.quickEntry.bottleButton')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-14"
          disabled={mutation.isPending}
          onClick={() => create({ feedingType: 'SOLID' })}
        >
          {t('feeding.quickEntry.solidButton')}
        </Button>
      </div>

      {showBottlePresets && (
        <div className="flex flex-wrap gap-2">
          {BOTTLE_AMOUNT_PRESETS_ML.map((amountMl) => (
            <button
              key={amountMl}
              type="button"
              disabled={mutation.isPending}
              onClick={() => create({ feedingType: 'BOTTLE', amountMl })}
            >
              <Badge variant="feeding-bottle" className="cursor-pointer px-3 py-1.5">
                {t('feeding.quickEntry.bottleAmountButton', { amount: amountMl })}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {mutation.isError && <ErrorMessage message={t(mapFeedingError(mutation.error, 'create'))} />}
    </section>
  );
}
