import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdModule } from '../household/household.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Module({
  // AuthModule: reuses its exported `AccessTokenVerifierService` for the WS
  // handshake auth (see `RealtimeGateway.handleConnection`). HouseholdModule:
  // reuses its exported `HouseholdAccessService` for the `joinHousehold`/
  // `leaveHousehold` membership check — injected directly (not via a guard),
  // so unlike e.g. `FeedingModule` there's no need to re-declare anything
  // here purely for `@UseGuards(...)` resolution.
  imports: [PrismaModule, AuthModule, HouseholdModule],
  providers: [RealtimeGateway, RealtimeService],
  // RealtimeService is exported so FeedingModule/SleepModule/DiaperModule
  // can inject it into their services and broadcast a change after
  // create/update/remove/stop (see e.g. `feeding/feeding.service.ts`).
  exports: [RealtimeService],
})
export class RealtimeModule {}
