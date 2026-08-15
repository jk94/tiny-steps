import { useEffect } from 'react';
import { registerPushNotifications } from './registerPushNotifications';

/**
 * Kicks off native push registration once the user is authenticated — a token
 * must be associated with a logged-in user, so this can't run at module scope
 * like `registerServiceWorker()`. Mounted from `ProtectedRoute`, which stays
 * mounted across the whole authenticated area. `registerPushNotifications`
 * carries its own once-per-session guard, so re-renders/StrictMode can't cause
 * duplicate registration.
 */
export function usePushRegistration(isAuthenticated: boolean): void {
  useEffect(() => {
    if (isAuthenticated) {
      void registerPushNotifications();
    }
  }, [isAuthenticated]);
}
