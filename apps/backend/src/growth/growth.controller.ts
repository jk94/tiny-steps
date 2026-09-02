import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { CreateGrowthMeasurementDto } from './dto/create-growth-measurement.dto';
import { GrowthRangeQueryDto } from './dto/growth-range-query.dto';
import { GrowthReferenceQueryDto } from './dto/growth-reference-query.dto';
import { UpdateGrowthMeasurementDto } from './dto/update-growth-measurement.dto';
import { GrowthService } from './growth.service';
import type { GrowthMeasurementSummary, GrowthReferenceResponse } from './growth.service';

/**
 * Growth measurements for one child (roadmap Phase 7.1).
 *
 * No `@RequireRole` on any route: both OWNER and CO_PARENT may record, edit
 * and delete measurements, exactly like the event controllers. A non-member
 * already resolves to 404 in `HouseholdMembershipGuard` before a role check
 * would run, so no route here can produce a 403.
 */
@Controller('households/:householdId/children/:childId/growth')
export class GrowthController {
  constructor(private readonly growthService: GrowthService) {}

  // Guard order matters: HouseholdMembershipGuard reads request.user
  // (populated by JwtAuthGuard), and CsrfGuard is last — same ordering as
  // FeedingController.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @Post()
  async create(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Body() dto: CreateGrowthMeasurementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GrowthMeasurementSummary> {
    return this.growthService.create(householdId, childId, user.id, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get()
  async list(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Query() range: GrowthRangeQueryDto,
  ): Promise<GrowthMeasurementSummary[]> {
    return this.growthService.list(householdId, childId, range);
  }

  // Must be declared before `GET :measurementId` — otherwise Nest/Express
  // route matching would capture "reference" as the id param (same reason
  // FeedingController declares `active-timer` first).
  //
  // The WHO tables are static, vendored data: the bands for a given
  // (child, indicator) only change if the child's sex changes, so a day of
  // private caching removes a ~250-point-per-curve payload from every tab
  // switch without any staleness risk worth worrying about.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get('reference')
  @Header('Cache-Control', 'private, max-age=86400')
  async getReference(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Query() query: GrowthReferenceQueryDto,
  ): Promise<GrowthReferenceResponse> {
    return this.growthService.getReference(householdId, childId, query.indicator);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get(':measurementId')
  async getOne(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('measurementId') measurementId: string,
  ): Promise<GrowthMeasurementSummary> {
    return this.growthService.findOne(householdId, childId, measurementId);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @Patch(':measurementId')
  async update(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('measurementId') measurementId: string,
    @Body() dto: UpdateGrowthMeasurementDto,
  ): Promise<GrowthMeasurementSummary> {
    return this.growthService.update(householdId, childId, measurementId, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @Delete(':measurementId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('measurementId') measurementId: string,
  ): Promise<void> {
    await this.growthService.remove(householdId, childId, measurementId);
  }
}
