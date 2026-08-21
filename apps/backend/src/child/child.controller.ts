import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdMembershipGuard } from '../household/guards/household-membership.guard';
import { RequireRole } from '../household/guards/require-role.decorator';
import { HouseholdRole } from '../household/household-role.enum';
import { MAX_PHOTO_BYTES } from './child-photo.constants';
import { ChildService } from './child.service';
import type { ChildSummary } from './child.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { ChildValidationExceptionFilter } from './filters/child-validation.exception-filter';
import { MulterExceptionFilter } from './filters/multer-exception.filter';

const PHOTO_FIELD_NAME = 'photo';
// Mirrors ALLOWED_PHOTO_MIME_TYPES; kept as a literal regex since
// ParseFilePipeBuilder's addFileTypeValidator expects a RegExp/string, not
// an array of exact values.
const PHOTO_MIME_TYPE_PATTERN = /^image\/(jpeg|png|webp)$/;

// Internal-only marker strings threaded through each validator's
// `errorMessage` so photoValidationPipe()'s shared `exceptionFactory` can
// tell which validator failed and attach the right machine-readable `code`
// — matching human-facing message text would be fragile, this isn't.
const PHOTO_TYPE_MISMATCH_MARKER = 'photo-invalid-type';
const PHOTO_TOO_LARGE_MARKER = 'photo-too-large';

/**
 * `photo` arrives as a memory buffer (not written to disk by Multer
 * itself) so `ChildService`/`ChildPhotoStorageService` fully control where/
 * when/under what name it lands on disk — see ADR-0003. `limits.fileSize`
 * is a hard backstop against buffering an abusive upload into memory;
 * `ParseFilePipeBuilder` below is the actual product-facing 400 for size/
 * type violations.
 */
function photoFileInterceptor() {
  return FileInterceptor(PHOTO_FIELD_NAME, {
    storage: memoryStorage(),
    limits: { fileSize: MAX_PHOTO_BYTES },
  });
}

function photoValidationPipe() {
  return new ParseFilePipeBuilder()
    .addFileTypeValidator({
      fileType: PHOTO_MIME_TYPE_PATTERN,
      errorMessage: PHOTO_TYPE_MISMATCH_MARKER,
    })
    .addMaxSizeValidator({ maxSize: MAX_PHOTO_BYTES, errorMessage: PHOTO_TOO_LARGE_MARKER })
    .build({
      fileIsRequired: false,
      errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      exceptionFactory: (marker) => {
        const code =
          marker === PHOTO_TYPE_MISMATCH_MARKER ? 'PHOTO_INVALID_TYPE' : 'PHOTO_TOO_LARGE';
        const message =
          code === 'PHOTO_INVALID_TYPE'
            ? 'Please choose a JPEG, PNG, or WebP image.'
            : 'The photo must be at most 2 MB.';
        return new BadRequestException({ statusCode: 400, code, message });
      },
    });
}

@Controller('households/:householdId/children')
export class ChildController {
  constructor(private readonly childService: ChildService) {}

  // Guard order matters: HouseholdMembershipGuard reads request.user
  // (populated by JwtAuthGuard), and CsrfGuard is last, mirroring
  // HouseholdController's `createInvite` route. Creation is restricted to
  // OWNER — see the role-scoping reconciliation in ADR-0003/roadmap.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(HouseholdRole.OWNER)
  @Post()
  @UseInterceptors(photoFileInterceptor())
  @UseFilters(MulterExceptionFilter, ChildValidationExceptionFilter)
  async create(
    @Param('householdId') householdId: string,
    @Body() dto: CreateChildDto,
    @UploadedFile(photoValidationPipe()) photo: Express.Multer.File | undefined,
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

  // No @RequireRole: Co-Parent can read/edit children per the role
  // reconciliation (create/delete only are Owner-restricted) — see
  // ADR-0003 and the roadmap's Definition of Done.
  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @Patch(':childId')
  @UseInterceptors(photoFileInterceptor())
  @UseFilters(MulterExceptionFilter, ChildValidationExceptionFilter)
  async update(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
    @Body() dto: UpdateChildDto,
    @UploadedFile(photoValidationPipe()) photo: Express.Multer.File | undefined,
  ): Promise<ChildSummary> {
    return this.childService.update(householdId, childId, dto, photo);
  }

  @UseGuards(JwtAuthGuard, HouseholdMembershipGuard, CsrfGuard)
  @RequireRole(HouseholdRole.OWNER)
  @Delete(':childId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('householdId') householdId: string,
    @Param('childId') childId: string,
  ): Promise<void> {
    await this.childService.remove(householdId, childId);
  }
}
