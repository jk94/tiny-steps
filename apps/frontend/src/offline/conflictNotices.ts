import { useQuery } from '@tanstack/react-query';
import type { EventType } from '../api/event-api';
import { queryClient } from '../lib/query-client';

/**
 * A user-facing notice that a buffered edit/timer-stop lost a Last-Write-Wins
 * conflict — the server had a more recent write, so the user's change was
 * overridden (see ADR-0011, JC-3). Surfaced by `ConflictNoticeBanner` as a
 * small, dismissible, app-root banner (never a blocking modal).
 */
export interface ConflictNotice {
  id: string;
  eventType: EventType;
  targetEventId: string;
}

/**
 * Query key for the in-memory conflict-notice list. Mirrors
 * `usePendingLocalEvents`'s React-Query-cache-as-store approach so no extra
 * state library is pulled in. Session-scoped only — notices are not persisted.
 */
const CONFLICT_NOTICES_QUERY_KEY = ['offline', 'conflict-notices'] as const;

function readNotices(): ConflictNotice[] {
  return queryClient.getQueryData<ConflictNotice[]>(CONFLICT_NOTICES_QUERY_KEY) ?? [];
}

/**
 * Records a new conflict notice. Deliberately keeps at most one notice per
 * `targetEventId` (a rapid re-conflict on the same event shouldn't stack up
 * duplicate banners).
 */
export function recordConflictNotice(eventType: EventType, targetEventId: string): void {
  const existing = readNotices();
  if (existing.some((notice) => notice.targetEventId === targetEventId)) {
    return;
  }
  const notice: ConflictNotice = {
    id: `conflict-${crypto.randomUUID()}`,
    eventType,
    targetEventId,
  };
  queryClient.setQueryData<ConflictNotice[]>(CONFLICT_NOTICES_QUERY_KEY, [...existing, notice]);
}

/** Dismisses a single notice by id (the banner's close button). */
export function dismissConflictNotice(id: string): void {
  queryClient.setQueryData<ConflictNotice[]>(
    CONFLICT_NOTICES_QUERY_KEY,
    readNotices().filter((notice) => notice.id !== id),
  );
}

/**
 * Subscribes a component to the current conflict notices. Backed by the same
 * React-Query cache the recorders write to, so a `setQueryData` re-renders every
 * consumer without an explicit invalidation.
 */
export function useConflictNotices(): ConflictNotice[] {
  const { data } = useQuery({
    queryKey: CONFLICT_NOTICES_QUERY_KEY,
    // Never fetches — the cache is populated imperatively by
    // `recordConflictNotice`. `initialData` keeps it from ever being `undefined`.
    queryFn: () => readNotices(),
    initialData: [] as ConflictNotice[],
    staleTime: Infinity,
  });
  return data;
}
