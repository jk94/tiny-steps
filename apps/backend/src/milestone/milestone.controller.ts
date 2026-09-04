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
  Res,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-request';
import { MulterExceptionFilter } from '../common/photo/multer-exception.filter';
import { photoFileInterceptor, photoValidationPipe } from '../common/photo/photo-upload';
import { HouseholdActor } from '../household/decorators/household-actor.decorator';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { RequireRole } from '../household/guards/require-role.decorator';
import { ENTRY_WRITE_ROLES, FULL_WRITE_ROLES } from '../household/household-permissions';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { MilestoneRangeQueryDto } from './dto/milestone-range-query.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { MilestoneValidationExceptionFilter } from './filters/milestone-validation.exception-filter';
import { MilestoneService } from './milestone.service';
import type { MilestonePhotoRef, MilestoneSummary } from './milestone.service';

// Unlike a child photo, this endpoint exists only to receive a file, so an
// empty request body is a client error rather than "no photo this time".
const milestonePhotoValidationPipe = () => photoValidationPipe({ isRequired: true });

/**
 * Developmental milestones for one child (roadmap Phase 7.2).
 *
 * Role scoping (Phase 7.5), exactly like the event and growth controllers:
 * reads are open to every member; recording, editing and *adding* a photo need
 * `ENTRY_WRITE_ROLES` — a CAREGIVER additionally only reaches milestones they
 * recorded themselves, enforced per-row in `MilestoneService` via
 * `assertMayEditEntry`. Deleting a milestone *or a single photo* needs
 * `FULL_WRITE_ROLES`: a caregiver may add to the family's record but never
 * destroy part of it, not even on their own entry. A non-member still resolves
 * to 404 in `HouseholdMembershipGuard` before any role check runs.
 */
@Controller('households/:householdId/children/:childId/milestones')
export class MilestoneController {
  constructor(private readonly milestoneService: MilestoneService) {}

  // Guard order matters: HouseholdMembershipGuard reads request.user
  // (populated by JwtAuthGuard), and CsrfGuard is last — same ordering as
  // GrowthController.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...ENTRY_WRITE_ROLES)
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
  @RequireRole(...ENTRY_WRITE_ROLES)
  @UseFilters(MilestoneValidationExceptionFilter)
  @Patch(':milestoneId')
  async update(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
    @HouseholdActor() actor: HouseholdActor,
  ): Promise<MilestoneSummary> {
    return this.milestoneService.update(householdId, childId, milestoneId, actor, dto);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...FULL_WRITE_ROLES)
  @Delete(':milestoneId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('milestoneId') milestoneId: string,
  ): Promise<void> {
    await this.milestoneService.remove(householdId, childId, milestoneId);
  }

  // One photo per request rather than a multi-file upload: a single failure
  // then only affects its own file, which is what lets the UI report a
  // per-file error and keep the rest (M-15).
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...ENTRY_WRITE_ROLES)
  @Post(':milestoneId/photos')
  @UseInterceptors(photoFileInterceptor())
  @UseFilters(MulterExceptionFilter, MilestoneValidationExceptionFilter)
  async addPhoto(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('milestoneId') milestoneId: string,
    @UploadedFile(milestonePhotoValidationPipe()) photo: Express.Multer.File,
    @HouseholdActor() actor: HouseholdActor,
  ): Promise<MilestonePhotoRef> {
    return this.milestoneService.addPhoto(householdId, childId, milestoneId, actor, photo);
  }

  // Buffers the whole (<=2MB) file into memory rather than streaming, so an
  // async ENOENT after headers are already sent can't happen — see
  // MilestoneService.getPhoto()/ADR-0003.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get(':milestoneId/photos/:photoId')
  async getPhoto(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('milestoneId') milestoneId: string,
    @Param('photoId') photoId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const photo = await this.milestoneService.getPhoto(householdId, childId, milestoneId, photoId);
    res.set({ 'Content-Type': photo.mimeType });
    return new StreamableFile(photo.buffer);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...FULL_WRITE_ROLES)
  @Delete(':milestoneId/photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePhoto(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Param('milestoneId') milestoneId: string,
    @Param('photoId') photoId: string,
  ): Promise<void> {
    await this.milestoneService.removePhoto(householdId, childId, milestoneId, photoId);
  }
}
