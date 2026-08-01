/**
 * No `updatedAt`/version field exists on `ChildSummary` server-side (see
 * `apps/backend/src/child/child.service.ts`), so there's nothing to key a
 * photo `<img src>` cache-buster off of. This module is a client-side,
 * in-memory, per-child counter used purely for that purpose:
 * `bumpPhotoCacheBust` is called after a child-update mutation that
 * included a new `photo`, and `<ChildPhoto>` reads the current value into
 * its `src`'s `v` query param so the browser re-fetches the image instead
 * of serving a stale cached one.
 *
 * Deliberately module-level (not persisted, not synced across tabs/reloads)
 * — a fresh page load has no stale in-memory `<img>` to bust anyway, so the
 * module-load-time default is always correct on first render.
 */
const DEFAULT_CACHE_BUST = Date.now();

const cacheBustByChildId = new Map<string, number>();

export function getPhotoCacheBust(childId: string): number {
  return cacheBustByChildId.get(childId) ?? DEFAULT_CACHE_BUST;
}

export function bumpPhotoCacheBust(childId: string): void {
  cacheBustByChildId.set(childId, Date.now());
}
