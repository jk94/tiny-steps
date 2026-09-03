/**
 * A one-slot handoff between the Capacitor push listener and React Router.
 *
 * The listener is registered outside React (see `registerPushNotifications.ts`)
 * and can fire *before* the router has mounted — a cold start from a tapped
 * notification is exactly that case. A plain module-level slot lets the tap be
 * recorded whenever it happens and consumed once the navigator is ready, which
 * a React context could not do.
 *
 * Deliberately holds at most one path: a second tap while one is still pending
 * simply replaces it, since only the most recent tap reflects where the user
 * actually wants to be.
 */

let pendingPath: string | null = null;
const listeners = new Set<() => void>();

/** Records a tapped notification's target. Overwrites any earlier pending one. */
export function setPendingDeepLink(path: string): void {
  pendingPath = path;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Returns the pending path and clears it, so a re-render can never navigate
 * twice for the same tap.
 */
export function consumePendingDeepLink(): string | null {
  const path = pendingPath;
  pendingPath = null;
  return path;
}

/** Subscribes to later taps; returns the unsubscribe function. */
export function subscribeToDeepLinks(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only reset, so one spec's pending tap cannot leak into the next. */
export function resetDeepLinkStore(): void {
  pendingPath = null;
  listeners.clear();
}
