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
  Res,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MulterExceptionFilter } from '../common/photo/multer-exception.filter';
import { photoFileInterceptor, photoValidationPipe } from '../common/photo/photo-upload';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { RequireRole } from '../household/guards/require-role.decorator';
import { FULL_WRITE_ROLES } from '../household/household-permissions';
import { ChildService } from './child.service';
import type { ChildSummary } from './child.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { ChildValidationExceptionFilter } from './filters/child-validation.exception-filter';

// A child photo is an optional part of a larger create/update body, so the
// shared pipe is built in its "not required" flavour here.
const childPhotoValidationPipe = () => photoValidationPipe({ isRequired: false });

@Controller('households/:householdId/children')
export class ChildController {
  constructor(private readonly childService: ChildService) {}

  // Guard order matters: HouseholdMembershipGuard reads request.user
  // (populated by JwtAuthGuard), and CsrfGuard is last, mirroring
  // HouseholdController's `createInvite` route.
  //
  // Managing child profiles is `FULL_WRITE_ROLES` (Phase 7.5): CO_PARENT joins
  // OWNER here — the Phase 7.5 permission matrix grants "create/change/delete
  // child profiles" to both, superseding the narrower OWNER-only scoping
  // ADR-0003 set when CO_PARENT was the only other role.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...FULL_WRITE_ROLES)
  @Post()
  @UseInterceptors(photoFileInterceptor())
  @UseFilters(MulterExceptionFilter, ChildValidationExceptionFilter)
  async create(
    @Param('householdId') householdId: string,
    @Body() dto: CreateChildDto,
    @UploadedFile(childPhotoValidationPipe()) photo: Express.Multer.File | undefined,
  ): Promise<ChildSummary> {
    return this.childService.create(householdId, dto, photo);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get()
  async list(@Param('householdId') householdId: string): Promise<ChildSummary[]> {
    return this.childService.list(householdId);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get(':childId')
  async getOne(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
  ): Promise<ChildSummary> {
    return this.childService.findOne(householdId, childId);
  }

  // Buffers the whole (<=2MB) file into memory rather than streaming, so an
  // async ENOENT after headers are already sent can't happen — see
  // ChildService.getPhoto()/ADR-0003.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
  @Get(':childId/photo')
  async getPhoto(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const photo = await this.childService.getPhoto(householdId, childId);
    res.set({ 'Content-Type': photo.mimeType });
    return new StreamableFile(photo.buffer);
  }

  // Editing a child profile is a household-management action, not an entry
  // edit: it is role-gated only, with no per-row ownership check — a child
  // profile has no single "recorded by" owner to compare against.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...FULL_WRITE_ROLES)
  @Patch(':childId')
  @UseInterceptors(photoFileInterceptor())
  @UseFilters(MulterExceptionFilter, ChildValidationExceptionFilter)
  async update(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Body() dto: UpdateChildDto,
    @UploadedFile(childPhotoValidationPipe()) photo: Express.Multer.File | undefined,
  ): Promise<ChildSummary> {
    return this.childService.update(householdId, childId, dto, photo);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(...FULL_WRITE_ROLES)
  @Delete(':childId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
  ): Promise<void> {
    await this.childService.remove(householdId, childId);
  }
}
