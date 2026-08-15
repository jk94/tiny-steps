import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { PushPlatform } from '../push-platform.enum';

/**
 * Body of `POST /api/push/subscriptions` — the FCM registration token from a
 * device plus which platform issued it. Upserted by `token` (see
 * `PushService.upsert`).
 */
export class CreatePushSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  // Validated against the enum values here; the service still routes it
  // through `toPushPlatform()` before persisting, mirroring how event types
  // are guarded.
  @IsIn(Object.values(PushPlatform))
  platform!: PushPlatform;
}
