import { Module } from '@nestjs/common';
import { EventModule } from '../../event/event.module';
import { GrowthModule } from '../../growth/growth.module';
import { HealthRecordModule } from '../../health-record/health-record.module';
import { MilestoneModule } from '../../milestone/milestone.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReactPdfRenderer } from './renderers/react-pdf/react-pdf.renderer';
import { REPORT_RENDERER } from './renderers/report-renderer.interface';
import { ReportDocumentBuilder } from './report-document.builder';
import { ReportService } from './report.service';

/**
 * The PDF report (roadmap Phase 7.4), kept as its own module rather than more
 * providers on `ExportModule`: it needs every phase 7.1–7.3 domain module plus
 * `EventModule`, and none of that belongs in the raw-data export's dependency
 * graph.
 *
 * No controller of its own — the report route lives on `ExportController`, so
 * that every output format for a child sits behind one path prefix.
 *
 * The renderer is bound to an injection token (EXP-10/EXP-11): selecting a
 * different implementation later is a change to this one provider entry.
 */
@Module({
  imports: [PrismaModule, GrowthModule, MilestoneModule, HealthRecordModule, EventModule],
  providers: [
    ReportService,
    ReportDocumentBuilder,
    { provide: REPORT_RENDERER, useClass: ReactPdfRenderer },
  ],
  exports: [ReportService],
})
export class ReportModule {}
