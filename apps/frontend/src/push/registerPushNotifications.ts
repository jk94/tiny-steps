import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { registerPushToken } from '../api/push-api';
import type { PushPlatform } from '../api/push-api';
import { setPendingDeepLink } from './deepLinkStore';
import { resolveDeepLinkPath, type PushData } from './resolveDeepLinkPath';

/**
 * Module-level guard so registration runs at most once per app session,
 * regardless of how many times the hook driving it re-renders (StrictMode
 * double-invocation, auth-state churn, ...). Mirrors `registerServiceWorker`'s
 * once-per-load intent.
 */
let registrationStarted = false;

/**
 * Registers this device for native push notifications and forwards the issued
 * FCM token to the backend.
 *
 * No-ops outside a native Capacitor build (`Capacitor.isNativePlatform()` is
 * false in the plain browser/PWA), matching `registerServiceWorker`'s
 * feature-detection style and CLAUDE.md's "push is via the wrapper, not Web
 * Push" note — the browser build never touches the push plugin.
 *
 * Failures are logged, not thrown: push is an enhancement, and the app must
 * stay fully usable if permission is denied or registration fails.
 */
export async function registerPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  if (registrationStarted) {
    return;
  }
  registrationStarted = true;

  try {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      // Allow a later retry (e.g. user grants permission from OS settings and
      // relaunches the flow) rather than latching "off" for the session.
      registrationStarted = false;
      return;
    }

    // On the `registration` event, upsert the token for the logged-in user.
    await PushNotifications.addListener('registration', (token) => {
      const platform: PushPlatform = Capacitor.getPlatform() === 'ios' ? 'IOS' : 'ANDROID';
      void registerPushToken(token.value, platform).catch((error: unknown) => {
        console.error('Failed to register push token with backend', error);
      });
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error', error);
    });

    // A notification arriving while the app is in the foreground still needs no
    // in-app handling beyond the OS default — the data it carries is already
    // in whatever list the user is looking at.
    await PushNotifications.addListener('pushNotificationReceived', () => {});

    // A *tapped* notification does (MED-11). The router is not reachable from
    // here, so the resolved path goes into the module-level store that
    // `DeepLinkNavigator` drains — which also covers a cold start, where this
    // fires long before React has mounted.
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const path = resolveDeepLinkPath((action.notification.data ?? {}) as PushData);
      if (path) {
        setPendingDeepLink(path);
      }
    });

    await PushNotifications.register();
  } catch (error) {
    registrationStarted = false;
    console.error('Push notification registration failed', error);
  }
}
