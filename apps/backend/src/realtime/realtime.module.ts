import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdModule } from '../household/household.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeCoreModule } from './realtime-core.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  // AuthModule: reuses its exported `AccessTokenVerifierService` for the WS
  // handshake auth (see `RealtimeGateway.handleConnection`). HouseholdModule:
  // reuses its exported `HouseholdAccessService` for the `joinHousehold`/
  // `leaveHousehold` membership check — injected directly (not via a guard),
  // so unlike e.g. `FeedingModule` there's no need to re-declare anything
  // here purely for `@UseGuards(...)` resolution. RealtimeCoreModule holds
  // `RealtimeService` itself; see that module for why it is split out.
  imports: [PrismaModule, AuthModule, HouseholdModule, RealtimeCoreModule],
  providers: [RealtimeGateway],
  // RealtimeCoreModule is re-exported so FeedingModule/SleepModule/
  // DiaperModule keep getting `RealtimeService` by importing this module, as
  // before — they broadcast a change after create/update/remove/stop (see
  // e.g. `feeding/feeding.service.ts`).
  exports: [RealtimeCoreModule],
})
export class RealtimeModule {}
