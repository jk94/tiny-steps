import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChildModule } from '../child/child.module';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { HouseholdModule } from '../household/household.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SleepController } from './sleep.controller';
import { SleepService } from './sleep.service';

@Module({
  // AuthModule/HouseholdModule: reuses their exported JwtAuthGuard/
  // CsrfGuard/HouseholdAccessService (sleep routes are nested under
  // /households/:householdId/children/:childId/sleep-events and reuse
  // the same membership check unmodified — see ChildModule's own doc
  // comment for the identical reasoning).
  // RealtimeModule: exports RealtimeService, injected into SleepService so
  // create/update/remove/stop can broadcast a change to the household's
  // WebSocket room (see FeedingModule's identical rationale).
  // ChildModule currently provides no functional wiring here: it doesn't
  // export ChildService (or any provider), so SleepService can't and
  // doesn't inject it — instead it re-implements the same child/household
  // scoping check directly via PrismaService (mirroring ChildService's own
  // `findChildOrThrow`, see SleepService's doc comment). The import is
  // kept anyway, intentionally, as a placeholder documenting the real
  // dependency relationship (household->child->sleep), same rationale as
  // FeedingModule's own doc comment — this is the second module to carry
  // it unchanged, not yet the trigger to extract a shared provider.
  // PrismaModule is `@Global()` already, but imported explicitly here for
  // clarity/consistency, mirroring HouseholdModule's/ChildModule's/
  // FeedingModule's own doc comments.
  imports: [PrismaModule, AuthModule, HouseholdModule, ChildModule, RealtimeModule],
  controllers: [SleepController],
  // HouseholdMembershipGuard is re-declared as a provider here (not just
  // pulled in via HouseholdModule's export): NestJS resolves a guard
  // referenced via `@UseGuards(GuardClass)` from the module that declares
  // the controller using it, not transitively through an imported module's
  // own provider graph — same pattern as `ChildModule`/`FeedingModule`.
  providers: [SleepService, HouseholdMembershipGuard],
})
export class SleepModule {}
