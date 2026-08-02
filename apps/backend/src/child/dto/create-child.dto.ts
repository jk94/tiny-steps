import { IsISO8601, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';

/**
 * Text fields of a `multipart/form-data` create-child request — the
 * optional `photo` file is a separate `@UploadedFile()` controller
 * parameter, not part of this DTO (see ADR-0003).
 */
export class CreateChildDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  birthDate!: string;
}
