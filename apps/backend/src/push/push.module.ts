import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfig } from '../config/configuration';
import { createFirebaseMessaging, FIREBASE_MESSAGING } from './firebase-messaging.provider';
import { PushController } from './push.controller';
import { PushSenderService } from './push-sender.service';
import { PushService } from './push.service';

@Module({
  // AuthModule: reuses its exported JwtAuthGuard/CsrfGuard for the
  // subscription routes (no HouseholdModule — push tokens are per-user, not
  // household-scoped). PrismaModule is @Global but imported explicitly for
  // consistency with the other modules.
  imports: [PrismaModule, AuthModule],
  controllers: [PushController],
  providers: [
    PushService,
    PushSenderService,
    {
      // Null when push isn't configured — PushSenderService treats that as
      // "push disabled". See ADR-0012.
      provide: FIREBASE_MESSAGING,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => createFirebaseMessaging(config),
    },
  ],
  // PushSenderService is consumed by NotificationModule's scheduler.
  exports: [PushSenderService],
})
export class PushModule {}
