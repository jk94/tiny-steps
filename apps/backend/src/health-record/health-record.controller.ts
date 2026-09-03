import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { CreateHealthRecordDto } from './dto/create-health-record.dto';
import { HealthRecordQueryDto } from './dto/health-record-query.dto';
import { UpdateHealthRecordDto } from './dto/update-health-record.dto';
import { HealthRecordValidationExceptionFilter } from './filters/health-record-validation.exception-filter';
import { HealthRecordService } from './health-record.service';
import type { HealthRecordSummary } from './health-record.service';

/**
 * Medications and vaccinations for one child (roadmap Phase 7.3).
 *
 * No `@RequireRole` on any route: both OWNER and CO_PARENT may record, edit and
 * delete health records, exactly like the event, growth and milestone
 * controllers. A non-member already resolves to 404 in
 * `HouseholdMembershipGuard` before a role check would run, so no route here
 * can produce a 403. The Betreuer/Beobachter audit of every writing endpoint is
 * deliberately deferred to Phase 7.5 (see the phase-7 README).
 *
 * Named `health-records` rather than `health`: the app already serves a bare
 * `GET /health` liveness endpoint (`src/health.controller.ts`), and although
 * that one is excluded from the `api` prefix and could not actually collide
 * with this nested path, two unrelated "health" routes would be a trap for the
 * next reader.
 */
@Controller('households/:householdId/children/:childId/health-records')
export class HealthRecordController {
  constructor(private readonly healthRecordService: HealthRecordService) {}

  // Guard order matters: HouseholdMembershipGuard reads request.user
  // (populated by JwtAuthGuard), and CsrfGuard is last — same ordering as
  // MilestoneController.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @UseFilters(HealthRecordValidationExceptionFilter)
  @Post()
  async create(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Body() dto: CreateHealthRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HealthRecordSummary> {
    return this.healthRecordService.create(householdId, childId, user.id, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get()
  async list(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Query() query: HealthRecordQueryDto,
  ): Promise<HealthRecordSummary[]> {
    return this.healthRecordService.list(householdId, childId, query);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get(':recordId')
  async getOne(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('recordId') recordId: string,
  ): Promise<HealthRecordSummary> {
    return this.healthRecordService.findOne(householdId, childId, recordId);
  }

  // Also the "mark as done" route (MED-5): the overview sends
  // `{ administeredAt: <now> }` through here rather than getting its own
  // endpoint, so the result stays a normal, editable record afterwards.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @UseFilters(HealthRecordValidationExceptionFilter)
  @Patch(':recordId')
  async update(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateHealthRecordDto,
  ): Promise<HealthRecordSummary> {
    return this.healthRecordService.update(householdId, childId, recordId, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @UseFilters(HealthRecordValidationExceptionFilter)
  @Delete(':recordId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('recordId') recordId: string,
  ): Promise<void> {
    await this.healthRecordService.remove(householdId, childId, recordId);
  }
}
