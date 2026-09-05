import { Controller, Get, Param, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { RequireRole } from '../household/guards/require-role.decorator';
import { EXPORT_ROLES } from '../household/household-permissions';
import { toCsv } from './csv.serializer';
import { ExportQueryDto } from './dto/export-query.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { ExportService } from './export.service';
import { ReportService } from './report/report.service';

/**
 * Child-level raw-data export (JSON + CSV). Read-only, so — like
 * `EventController` — no `CsrfGuard`.
 *
 * Unlike the other read routes this one *is* role-scoped: generating an export
 * bundles a child's whole history into one downloadable file, which the Phase
 * 7.5 permission matrix withholds from OBSERVER. `@RequireRole` works on GET
 * routes just as well as on writes — the guard only reads metadata, it does not
 * look at the HTTP method when a requirement is present.
 *
 * Both handlers buffer the full payload in memory before responding, copying
 * `ChildController.getPhoto`'s approach (see ADR-0003's ENOENT-avoidance
 * rationale): the dataset here — one household child's events — is small
 * enough that streaming would add complexity for no benefit.
 */
@Controller('households/:householdId/children/:childId/export')
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
@RequireRole(...EXPORT_ROLES)
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly reportService: ReportService,
  ) {}

  @Get('json')
  async exportJson(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Query() query: ExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const rows = await this.exportService.getRawEvents(
      householdId,
      childId,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );

    const buffer = Buffer.from(JSON.stringify(rows, null, 2), 'utf8');
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="export-${childId}.json"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('csv')
  async exportCsv(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Query() query: ExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const rows = await this.exportService.getRawEvents(
      householdId,
      childId,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );

    const buffer = Buffer.from(toCsv(rows), 'utf8');
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="export-${childId}.csv"`,
    });
    return new StreamableFile(buffer);
  }

  /**
   * The curated PDF report (roadmap Phase 7.4), as opposed to the two raw-data
   * dumps above. Same guards for the same reason (EXP-14): it only reads, so
   * any household member may generate one.
   *
   * A completely empty result is a 422 rather than a PDF — see
   * `ReportService.generatePdf`.
   */
  @Get('report.pdf')
  async exportReportPdf(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.reportService.generatePdf(householdId, childId, query);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${childId}.pdf"`,
    });
    return new StreamableFile(buffer);
  }
}
