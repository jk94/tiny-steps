/**
 * Same-document View Transitions for router navigations — the "expanding
 * tile" effect (a child tile growing into the child-home hero, a milestone
 * tile into its detail cover). See ADR-0016.
 *
 * React Router's own `viewTransition` prop only works in its data-router
 * modes; this app uses the declarative `<BrowserRouter>`, which applies a
 * location change inside `React.startTransition`. A `flushSync` around
 * `navigate()` therefore can't force the new route into the DOM before the
 * browser takes its "after" snapshot. Instead the transition's update
 * callback returns a promise that `Layout` resolves from a layout effect once
 * the new location has committed (`resolvePendingViewTransition`), with a
 * timeout as a safety net so a navigation that never commits can't freeze
 * the page behind a stale snapshot.
 *
 * Progressive enhancement only: without the API (older browsers, jsdom in
 * tests) or under `prefers-reduced-motion: reduce`, `navigateWithViewTransition`
 * just navigates.
 */

/** Longest the browser may hold the old snapshot while the new route renders. */
const COMMIT_TIMEOUT_MS = 500;

let pendingResolve: (() => void) | null = null;

interface ViewTransitionLike {
  finished: Promise<unknown>;
  ready: Promise<unknown>;
  updateCallbackDone: Promise<unknown>;
}

type DocumentWithViewTransitions = Document & {
  startViewTransition?: (update: () => Promise<void> | void) => ViewTransitionLike;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Whether a navigation started now would be animated. */
export function canUseViewTransitions(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof (document as DocumentWithViewTransitions).startViewTransition === 'function' &&
    !prefersReducedMotion()
  );
}

/**
 * Runs `navigate` inside a view transition when possible, otherwise directly.
 */
export function navigateWithViewTransition(navigate: () => void): void {
  const doc = document as DocumentWithViewTransitions;
  if (!canUseViewTransitions() || !doc.startViewTransition) {
    navigate();
    return;
  }

  const transition = doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        const timeout = window.setTimeout(done, COMMIT_TIMEOUT_MS);
        function done() {
          window.clearTimeout(timeout);
          if (pendingResolve === done) {
            pendingResolve = null;
          }
          resolve();
        }
        // A transition started while another is still waiting supersedes it;
        // let the old one finish rather than leave it hanging until timeout.
        pendingResolve?.();
        pendingResolve = done;
        navigate();
      }),
  );

  // A skipped transition rejects these; that is not an error worth surfacing.
  transition.finished.catch(() => undefined);
  transition.ready.catch(() => undefined);
  transition.updateCallbackDone.catch(() => undefined);
}

/**
 * Whether a view transition is waiting for the next route to render. A page
 * mounted while this is true is being animated by the transition already, so
 * it skips its own enter animation (see `PageEnter` in `Layout`).
 */
export function isViewTransitionPending(): boolean {
  return pendingResolve !== null;
}

/** Called by `Layout` once a new location has been committed to the DOM. */
export function resolvePendingViewTransition(): void {
  pendingResolve?.();
}

/**
 * The `view-transition-name` style for an element taking part in a shared
 * "expanding tile" transition. Names must be unique per page and valid CSS
 * identifiers; ids may start with a digit (UUIDs), hence the prefix.
 */
export function viewTransitionStyle(kind: string, id: string): { viewTransitionName: string } {
  return { viewTransitionName: `${kind}-${id.replace(/[^a-zA-Z0-9_-]/g, '')}` };
}
