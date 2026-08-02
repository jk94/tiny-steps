import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { stopFeedingTimer } from '../api/feeding-api';
import type { FeedingEventSummary, FeedingSide } from '../api/feeding-api';
import { mapFeedingError } from '../feeding/mapFeedingError';
import { queryClient } from '../lib/query-client';
import { ErrorMessage } from './ErrorMessage';

const TICK_INTERVAL_MS = 1000;

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const SIDE_LABEL_KEYS: Record<FeedingSide, 'feeding.timer.sideLeft' | 'feeding.timer.sideRight'> = {
  LEFT: 'feeding.timer.sideLeft',
  RIGHT: 'feeding.timer.sideRight',
};

export interface FeedingTimerProps {
  householdId: string;
  childId: string;
  event: FeedingEventSummary;
}

/**
 * Displays a running breastfeeding timer + a single "Stop" button. Elapsed
 * time is recomputed from `Date.now() - startedAt` on every tick (never
 * accumulated), so it can't drift and self-corrects across tab
 * backgrounding/sleep. `event.startedAt` is the sole source of truth — on
 * a fresh mount (e.g. after a page reload) this reads the same running
 * event straight from the server via `FeedingHome`'s `active-timer` query,
 * which is how the timer survives an app restart with zero local
 * persistence.
 */
export function FeedingTimer({ householdId, childId, event }: FeedingTimerProps) {
  const { t } = useTranslation();
  // Lazy `useState` initializers are the one place React condones an
  // impure read like `Date.now()` — it runs exactly once, on mount, not on
  // every render. `event.startedAt` should always be set here (this
  // component only renders for a running BREAST timer), the `Date.now()`
  // fallback is a defensive no-op for that invariant.
  const [startedAtMs] = useState(() =>
    event.startedAt ? new Date(event.startedAt).getTime() : Date.now(),
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)),
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    }, TICK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [startedAtMs]);

  const mutation = useMutation({
    mutationFn: () => stopFeedingTimer(householdId, childId, event.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['households', householdId, 'children', childId, 'feeding-events'],
      });
    },
  });

  return (
    <section>
      <h2>{t('feeding.timer.title')}</h2>
      {event.side && <p>{t(SIDE_LABEL_KEYS[event.side])}</p>}
      <p role="timer">{formatElapsed(elapsedSeconds)}</p>
      <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        {t(mutation.isPending ? 'feeding.timer.stopButtonPending' : 'feeding.timer.stopButton')}
      </button>
      {mutation.isError && <ErrorMessage message={t(mapFeedingError(mutation.error, 'stop'))} />}
    </section>
  );
}
