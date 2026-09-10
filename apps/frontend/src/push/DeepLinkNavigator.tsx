import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { consumePendingDeepLink, subscribeToDeepLinks } from './deepLinkStore';

/**
 * Drains the pending push deep link into the router (MED-11).
 *
 * Renders nothing — it exists only to hold the `useNavigate` the non-React push
 * listener cannot reach. Mounted once inside the router, above the routes, so a
 * tap navigates regardless of which screen is currently open.
 *
 * The single effect covers both timings: a cold start where the tap was already
 * recorded before React mounted (drained immediately), and a tap while the app
 * is running (delivered through the store's subscription). Consuming clears the
 * slot, so StrictMode's double-invoked effect cannot navigate twice.
 */
export function DeepLinkNavigator() {
  const navigate = useNavigate();

  useEffect(() => {
    const drain = () => {
      const path = consumePendingDeepLink();
      if (path) {
        void navigate(path);
      }
    };

    // Subscribe first, then drain: a tap landing between the two would
    // otherwise be recorded with nobody listening and no drain left to run.
    const unsubscribe = subscribeToDeepLinks(drain);
    drain();
    return unsubscribe;
  }, [navigate]);

  return null;
}
