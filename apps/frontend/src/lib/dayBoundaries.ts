export interface LocalDayBoundaries {
  /** Inclusive local-midnight start of the day, as an ISO-8601 UTC instant. */
  from: string;
  /** Exclusive local-midnight start of the NEXT day, as an ISO-8601 UTC instant. */
  to: string;
  /**
   * `YYYY-MM-DD` local-date string — used only as a React Query cache-key
   * differentiator (e.g. `['households', hId, 'children', cId, 'events',
   * 'daily', dateKey]`) so switching days re-queries instead of showing
   * stale data. Never sent to the backend: the backend does zero timezone
   * reasoning, it only ever sees the two `from`/`to` instants (see
   * `event-api.ts`).
   */
  dateKey: string;
}

/**
 * Computes the `[from, to)` instant range covering a single local calendar
 * day containing `date` (defaulting to now). Deliberately built from the
 * `Date` constructor's local-time fields (`getFullYear`/`getMonth`/
 * `getDate`), not any UTC arithmetic, so this is correct regardless of the
 * browser's timezone/DST offset — the two instants are then serialized via
 * `toISOString()` for the backend's `EventRangeQueryDto`.
 */
export function getLocalDayBoundaries(date: Date = new Date()): LocalDayBoundaries {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
  const startOfNextDay = new Date(year, month, day + 1, 0, 0, 0, 0);

  return {
    from: startOfDay.toISOString(),
    to: startOfNextDay.toISOString(),
    dateKey: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}
