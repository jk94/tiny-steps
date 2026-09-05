import { useQuery } from '@tanstack/react-query';
import type { EventType } from '../api/event-api';
import { queryClient } from '../lib/query-client';

/**
 * Why a buffered write was dropped instead of retried:
 *  - `CONFLICT`: it lost a Last-Write-Wins conflict — the server had a more
 *    recent write, so the user's change was overridden (ADR-0011, JC-3).
 *  - `FORBIDDEN`: the server rejected it with 403 because the user's household
 *    role may not perform that write. Retrying the identical payload can never
 *    succeed, so the buffered copy is dropped rather than left as a permanent
 *    "not saved" ghost row.
 */
export type OfflineNoticeKind = 'CONFLICT' | 'FORBIDDEN';

/**
 * A user-facing notice that a buffered create/edit/timer-stop was dropped —
 * either overridden by a newer server write or rejected as not permitted for
 * the user's role. Surfaced by `ConflictNoticeBanner` as a small, dismissible,
 * app-root banner (never a blocking modal).
 */
export interface ConflictNotice {
  id: string;
  kind: OfflineNoticeKind;
  eventType: EventType;
  /**
   * Deduplication key: the server event id for an edit/timer-stop, or the
   * buffered record's `localId` for a create (which has no server id yet).
   */
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
 * Records a notice of the given kind. Deliberately keeps at most one notice per
 * `kind`+`targetEventId` (a rapid re-conflict on the same event shouldn't stack
 * up duplicate banners), while still letting a conflict and a role rejection on
 * the same event coexist — they say different things.
 */
function recordNotice(kind: OfflineNoticeKind, eventType: EventType, targetEventId: string): void {
  const existing = readNotices();
  if (existing.some((notice) => notice.kind === kind && notice.targetEventId === targetEventId)) {
    return;
  }
  const notice: ConflictNotice = {
    id: `${kind.toLowerCase()}-${crypto.randomUUID()}`,
    kind,
    eventType,
    targetEventId,
  };
  queryClient.setQueryData<ConflictNotice[]>(CONFLICT_NOTICES_QUERY_KEY, [...existing, notice]);
}

/** Records a Last-Write-Wins conflict notice (JC-3). */
export function recordConflictNotice(eventType: EventType, targetEventId: string): void {
  recordNotice('CONFLICT', eventType, targetEventId);
}

/**
 * Records a "your role may not do this" notice after a 403. `key` is the server
 * event id for an edit/stop, or the buffered record's `localId` for a create.
 */
export function recordForbiddenNotice(eventType: EventType, key: string): void {
  recordNotice('FORBIDDEN', eventType, key);
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
