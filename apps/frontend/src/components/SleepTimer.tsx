import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { stopSleepTimerOptimistic } from '../api/sleep-api';
import type { SleepEventSummary } from '../api/sleep-api';
import { Badge, Button, Card } from './ui';

const TICK_INTERVAL_MS = 1000;

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export interface SleepTimerProps {
  householdId: string;
  childId: string;
  event: SleepEventSummary;
}

/**
 * Displays a running sleep timer + a single "Stop" button. Near-identical
 * to `FeedingTimer`, minus the side label (no equivalent for Sleep).
 * Elapsed time is recomputed from `Date.now() - startedAt` on every tick
 * (never accumulated), so it can't drift and self-corrects across tab
 * backgrounding/sleep. `event.startedAt` is the sole source of truth — on
 * a fresh mount (e.g. after a page reload) this reads the same running
 * event straight from the server via `SleepHome`'s `active-timer` query,
 * which is how the timer survives an app restart with zero local
 * persistence.
 */
export function SleepTimer({ householdId, childId, event }: SleepTimerProps) {
  const { t } = useTranslation();
  // Lazy `useState` initializers are the one place React condones an
  // impure read like `Date.now()` — it runs exactly once, on mount, not on
  // every render. `event.startedAt` should always be set here (Sleep
  // events always have a startedAt — see `SleepService.create`), the
  // `Date.now()` fallback is a defensive no-op for that invariant.
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

  // See FeedingTimer: the optimistic stop buffers a pending `'stop'` record and
  // invalidates the pending query before the network call, so `SleepHome` swaps
  // to its stopped/optimistic state immediately (JC-2); reconciliation lives
  // there and in the engine, so no error UI is needed here.
  const mutation = useMutation({
    mutationFn: () =>
      stopSleepTimerOptimistic(householdId, childId, event, new Date().toISOString()),
  });

  return (
    <Card>
      <Card.Body className="flex flex-col items-center gap-3 py-8">
        <Badge variant="sleep" className="text-sm">
          {t('sleep.timer.title')}
        </Badge>
        <p role="timer" className="text-4xl font-extrabold tabular-nums text-foreground">
          {formatElapsed(elapsedSeconds)}
        </p>
        <Button
          type="button"
          variant="destructive"
          isLoading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {t(mutation.isPending ? 'sleep.timer.stopButtonPending' : 'sleep.timer.stopButton')}
        </Button>
      </Card.Body>
    </Card>
  );
}
