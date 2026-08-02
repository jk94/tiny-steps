import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChildModule } from '../child/child.module';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { HouseholdModule } from '../household/household.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EventController } from './event.controller';
import { EventService } from './event.service';

@Module({
  // Mirrors FeedingModule's import list exactly, minus RealtimeModule:
  // EventService is query-only (see its own doc comment), so it has nothing
  // to broadcast.
  imports: [PrismaModule, AuthModule, HouseholdModule, ChildModule],
  controllers: [EventController],
  // HouseholdMembershipGuard is re-declared as a provider here (not just
  // pulled in via HouseholdModule's export) — same reasoning as
  // FeedingModule/ChildModule, see their own doc comments.
  providers: [EventService, HouseholdMembershipGuard],
})
export class EventModule {}
