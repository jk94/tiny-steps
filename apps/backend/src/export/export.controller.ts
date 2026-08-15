import { Controller, Get, Param, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { toCsv } from './csv.serializer';
import { ExportQueryDto } from './dto/export-query.dto';
import { ExportService } from './export.service';

/**
 * Child-level raw-data export (JSON + CSV). Read-only, so — like
 * `EventController` — no `CsrfGuard` and no `@RequireRole`: any household
 * member may export, the same read-access rule as `/events/daily` and
 * `/events/stats`.
 *
 * Both handlers buffer the full payload in memory before responding, copying
 * `ChildController.getPhoto`'s approach (see ADR-0003's ENOENT-avoidance
 * rationale): the dataset here — one household child's events — is small
 * enough that streaming would add complexity for no benefit.
 */
@Controller('households/:householdId/children/:childId/export')
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

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
}
