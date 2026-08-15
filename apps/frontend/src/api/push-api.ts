import { apiFetch } from './http-client';

export type PushPlatform = 'ANDROID' | 'IOS';

/**
 * Registers (upserts) this device's FCM token with the backend so the user can
 * receive push notifications. Called from `registerPushNotifications` on the
 * native `registration` event — see that module's doc comment.
 */
export function registerPushToken(token: string, platform: PushPlatform): Promise<void> {
  return apiFetch<void>('/push/subscriptions', {
    method: 'POST',
    body: { token, platform },
  });
}
