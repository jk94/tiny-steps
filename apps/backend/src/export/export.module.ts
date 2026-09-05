import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChildModule } from '../child/child.module';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { HouseholdModule } from '../household/household.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { ReportModule } from './report/report.module';

@Module({
  // Mirrors EventModule's import list exactly: ExportService is query-only,
  // so it has nothing to broadcast and needs no RealtimeModule.
  //
  // ReportModule brings the PDF report's own dependency graph (every phase
  // 7.1–7.3 domain module plus EventModule) rather than adding all of that
  // here — the raw-data export needs none of it.
  imports: [PrismaModule, AuthModule, HouseholdModule, ChildModule, ReportModule],
  controllers: [ExportController],
  // HouseholdMembershipGuard is re-declared as a provider here (not just
  // pulled in via HouseholdModule's export) — same reasoning as
  // EventModule/FeedingModule/ChildModule, see their own doc comments.
  providers: [ExportService, HouseholdMembershipGuard],
})
export class ExportModule {}
