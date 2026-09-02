import type { QueuedPhoto } from './uploadQueuedPhotos';

/**
 * One-shot handoff of a failed photo queue from the create page to the edit
 * page.
 *
 * When a milestone is created but some of its photos are not, the record
 * exists — so the user is moved to its edit page rather than being left on a
 * create form for something that already saved. The `File` objects still have
 * to travel with them, otherwise the retry would mean re-picking every file.
 *
 * Deliberately a module-scoped single slot rather than React Router's
 * `navigate(..., { state })`: router state is persisted through
 * `history.replaceState`, which structured-clones and **stores** the payload
 * (Firefox documents a 16 MiB ceiling and writes it to disk). Ten 2 MB photos
 * — precisely the case that fails while offline — would sit right at that
 * limit and could make the navigation itself throw, which would strand the
 * user on a page for a milestone that was already created. Passing an
 * in-memory reference instead costs nothing and cannot fail.
 *
 * `take` clears the slot, so this survives exactly one client-side navigation:
 * a page reload starts from the stored milestone with an empty queue, which is
 * the honest state — the `File` objects are gone with the JS context.
 */
let handoff: { milestoneId: string; photos: QueuedPhoto[] } | null = null;

export function stashPhotoRetryQueue(milestoneId: string, photos: QueuedPhoto[]): void {
  handoff = { milestoneId, photos };
}

/**
 * Reads the queue stashed for `milestoneId`, then clears it on the next
 * microtask. Returns `undefined` when there is none, or when the slot belongs
 * to a different milestone (a stale stash must never leak another record's
 * files into this form).
 *
 * The deferred clear is deliberate: this is called from a `useState`
 * initializer, which React's StrictMode invokes twice in development. Clearing
 * synchronously would make the second call return `undefined` and, depending on
 * which result React keeps, silently drop the handed-over files. Both
 * synchronous calls see the same queue; by the next tick the consumer has
 * committed it to component state.
 */
export function takePhotoRetryQueue(milestoneId: string): QueuedPhoto[] | undefined {
  if (handoff?.milestoneId !== milestoneId) {
    return undefined;
  }
  const { photos } = handoff;
  queueMicrotask(() => {
    if (handoff?.milestoneId === milestoneId) {
      handoff = null;
    }
  });
  return photos;
}

/** Test seam: drops any stashed queue without reading it. */
export function clearPhotoRetryQueue(): void {
  handoff = null;
}
