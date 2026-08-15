import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { AppConfig } from '../config/configuration';

/**
 * DI token for the (possibly null) Firebase `Messaging` instance. Kept as a
 * distinct token so `PushSenderService` depends on the seam, not on
 * `firebase-admin` directly — tests inject a fake messaging object instead of
 * ever touching Firebase.
 */
export const FIREBASE_MESSAGING = Symbol('FIREBASE_MESSAGING');

/**
 * Builds the Firebase `Messaging` client from the optional `push.firebase`
 * config, or returns `null` when push isn't configured (see AppConfig.push /
 * ADR-0012). Returning null rather than throwing keeps a push-less deployment
 * fully functional — `PushSenderService` treats null as "push disabled".
 *
 * `getApps()` guards against re-initializing the default Firebase app if the
 * factory ever runs more than once (e.g. across test module recompilations),
 * which `initializeApp` would otherwise reject.
 */
export function createFirebaseMessaging(config: ConfigService<AppConfig, true>): Messaging | null {
  const logger = new Logger('FirebaseMessaging');
  const pushConfig = config.get('push', { infer: true });

  if (!pushConfig) {
    logger.log('No `push` config section found — push notifications are disabled.');
    return null;
  }

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({ credential: cert(pushConfig.firebase.serviceAccountPath) });

  logger.log('Firebase messaging initialized — push notifications enabled.');
  return getMessaging(app);
}
