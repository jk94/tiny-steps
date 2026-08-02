import { useEffect, useState } from 'react';

/**
 * Re-renders its caller every `intervalMs` by returning a fresh
 * `Date.now()` snapshot on each tick. Used by `TimeSinceCard` so a
 * "time since last event" figure keeps advancing on the wall clock alone,
 * without any new data arriving from the server.
 */
export function useTick(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
