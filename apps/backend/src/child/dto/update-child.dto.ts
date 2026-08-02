import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';

/**
 * Text fields of a `multipart/form-data` update-child request (PATCH/
 * partial-update semantics — both fields optional). The optional `photo`
 * file is a separate `@UploadedFile()` controller parameter, not part of
 * this DTO (see ADR-0003).
 */
export class UpdateChildDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  birthDate?: string;
}
