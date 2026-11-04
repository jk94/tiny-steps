import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ClockService } from '../common/clock.service';
import type { AppConfig } from '../config/configuration';
import { DiaperModule } from '../diaper/diaper.module';
import { EventModule } from '../event/event.module';
import { FeedingModule } from '../feeding/feeding.module';
import { HealthRecordModule } from '../health-record/health-record.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SleepModule } from '../sleep/sleep.module';
import { AlexaChildDirectory } from './alexa-child-directory.service';
import { AlexaEnabledGuard } from './alexa-enabled.guard';
import { AlexaLinkController } from './links/alexa-link.controller';
import { AlexaLinkService } from './links/alexa-link.service';
import { AlexaOAuthController } from './oauth/alexa-oauth.controller';
import { AlexaOAuthService } from './oauth/alexa-oauth.service';
import { AlexaApiClient } from './skill/alexa-api.client';
import { AlexaMessages } from './skill/alexa-messages';
import { AlexaRequestVerifier } from './skill/alexa-request-verifier';
import { AlexaSkillController } from './skill/alexa-skill.controller';
import { AlexaSkillService } from './skill/alexa-skill.service';
import { AlexaQueryHandlers } from './skill/handlers/query.handlers';
import { AlexaRecordingHandlers } from './skill/handlers/recording.handlers';
import { AlexaReminderHandlers } from './skill/handlers/reminder.handlers';

/**
 * Phase 8: the Alexa skill endpoint, the OAuth 2.0 server behind account
 * linking, and the app-side link management (ADR-0017). Always loaded; every
 * route is hidden behind `AlexaEnabledGuard` unless `config.yml` has an
 * `alexa` section.
 *
 * Imports the tracking modules for their *services* only — the skill records
 * and reads through exactly the code paths the REST routes use.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    FeedingModule,
    SleepModule,
    DiaperModule,
    EventModule,
    HealthRecordModule,
  ],
  controllers: [AlexaOAuthController, AlexaLinkController, AlexaSkillController],
  providers: [
    AlexaEnabledGuard,
    AlexaChildDirectory,
    AlexaOAuthService,
    AlexaLinkService,
    AlexaApiClient,
    AlexaSkillService,
    AlexaRecordingHandlers,
    AlexaQueryHandlers,
    AlexaReminderHandlers,
    ClockService,
    {
      provide: AlexaMessages,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        new AlexaMessages(config.get('alexa', { infer: true })?.responses),
    },
    {
      provide: AlexaRequestVerifier,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        new AlexaRequestVerifier(config.get('alexa', { infer: true })?.skillId ?? null),
    },
  ],
})
export class AlexaModule {}
