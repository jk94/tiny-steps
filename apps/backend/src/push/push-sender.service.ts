import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BatchResponse, Messaging, MulticastMessage } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';
import { FIREBASE_MESSAGING } from './firebase-messaging.provider';

export interface PushNotificationPayload {
  title: string;
  body: string;
  /** Optional data payload (all values must be strings, per FCM). */
  data?: Record<string, string>;
}

/**
 * FCM error code returned for a token that's no longer valid (app uninstalled,
 * token rotated, ...). Such tokens are pruned from `PushSubscription` so we
 * stop trying to deliver to dead devices — see `cleanupStaleTokens`.
 */
const TOKEN_NOT_REGISTERED = 'messaging/registration-token-not-registered';

/**
 * Thin, mockable wrapper around `firebase-admin`'s multicast send. Everything
 * push-related that actually talks to Firebase goes through here, so the rest
 * of the app (scheduler, controllers) never imports `firebase-admin` and tests
 * mock this one seam.
 *
 * When push isn't configured (`FIREBASE_MESSAGING` is null — see
 * `createFirebaseMessaging`), sends are a logged no-op rather than an error, so
 * a push-less deployment keeps working.
 */
@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);

  constructor(
    @Inject(FIREBASE_MESSAGING) private readonly messaging: Messaging | null,
    private readonly prisma: PrismaService,
  ) {}

  async sendToTokens(tokens: string[], payload: PushNotificationPayload): Promise<void> {
    if (tokens.length === 0) {
      return;
    }
    if (!this.messaging) {
      this.logger.warn(
        `Push not configured — skipping notification "${payload.title}" to ${tokens.length} token(s).`,
      );
      return;
    }

    const message: MulticastMessage = {
      tokens,
      notification: { title: payload.title, body: payload.body },
      ...(payload.data ? { data: payload.data } : {}),
    };

    const response = await this.messaging.sendEachForMulticast(message);
    await this.cleanupStaleTokens(tokens, response);
  }

  /**
   * Deletes any `PushSubscription` whose token FCM reported as
   * unregistered — position-matched against the request's `tokens` array,
   * since `sendEachForMulticast` returns responses in the same order.
   */
  private async cleanupStaleTokens(tokens: string[], response: BatchResponse): Promise<void> {
    const staleTokens = response.responses
      .map((result, index) => ({ result, token: tokens[index] }))
      .filter(({ result }) => !result.success && result.error?.code === TOKEN_NOT_REGISTERED)
      .map(({ token }) => token);

    if (staleTokens.length === 0) {
      return;
    }

    await this.prisma.pushSubscription.deleteMany({ where: { token: { in: staleTokens } } });
    this.logger.log(`Pruned ${staleTokens.length} stale push token(s).`);
  }
}
