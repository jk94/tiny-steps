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
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { MilestoneRangeQueryDto } from './dto/milestone-range-query.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { MilestoneValidationExceptionFilter } from './filters/milestone-validation.exception-filter';
import { MilestoneService } from './milestone.service';
import type { MilestoneSummary } from './milestone.service';

/**
 * Developmental milestones for one child (roadmap Phase 7.2).
 *
 * No `@RequireRole` on any route: both OWNER and CO_PARENT may record, edit
 * and delete milestones, exactly like the event and growth controllers. A
 * non-member already resolves to 404 in `HouseholdMembershipGuard` before a
 * role check would run, so no route here can produce a 403. The
 * Betreuer/Beobachter audit of every writing endpoint is deliberately deferred
 * to Phase 7.5 (see the phase-7 README).
 */
@Controller('households/:householdId/children/:childId/milestones')
export class MilestoneController {
  constructor(private readonly milestoneService: MilestoneService) {}

  // Guard order matters: HouseholdMembershipGuard reads request.user
  // (populated by JwtAuthGuard), and CsrfGuard is last — same ordering as
  // GrowthController.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @UseFilters(MilestoneValidationExceptionFilter)
  @Post()
  async create(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MilestoneSummary> {
    return this.milestoneService.create(householdId, childId, user.id, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get()
  async list(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Query() range: MilestoneRangeQueryDto,
  ): Promise<MilestoneSummary[]> {
    return this.milestoneService.list(householdId, childId, range);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get(':milestoneId')
  async getOne(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('milestoneId') milestoneId: string,
  ): Promise<MilestoneSummary> {
    return this.milestoneService.findOne(householdId, childId, milestoneId);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @UseFilters(MilestoneValidationExceptionFilter)
  @Patch(':milestoneId')
  async update(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ): Promise<MilestoneSummary> {
    return this.milestoneService.update(householdId, childId, milestoneId, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @Delete(':milestoneId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('milestoneId') milestoneId: string,
  ): Promise<void> {
    await this.milestoneService.remove(householdId, childId, milestoneId);
  }
}
