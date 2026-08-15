import { Injectable } from '@nestjs/common';
import { PushSubscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { toPushPlatform } from './push-platform.enum';

/**
 * Manages a user's device push-subscription tokens. Not household-scoped: a
 * token identifies a physical device belonging to one user, independent of any
 * household — so registration/removal is guarded by `JwtAuthGuard` alone.
 */
@Injectable()
export class PushService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upserts a device token by its unique `token` value. A device re-registers
   * on every app launch (and its token can be reassigned to a different user
   * after a reinstall/account switch), so an existing row is updated to point
   * at the current user/platform rather than duplicated or rejected.
   */
  async upsert(userId: string, dto: CreatePushSubscriptionDto): Promise<PushSubscription> {
    const platform = toPushPlatform(dto.platform);

    return this.prisma.pushSubscription.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform },
      update: { userId, platform },
    });
  }

  /**
   * Removes a device token (e.g. on logout). Scoped to the calling user so one
   * user can't delete another's subscription; a token that doesn't exist (or
   * belongs to someone else) is a silent no-op rather than an error, keeping
   * logout idempotent.
   */
  async remove(userId: string, token: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { token, userId } });
  }
}
