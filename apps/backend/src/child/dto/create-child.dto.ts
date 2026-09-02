import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';
import { ChildSex } from '../child-sex.enum';
import { CLEAR_CHILD_SEX } from './update-child.dto';

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

  // Optional; omitting it means "not specified", which is a valid, explicit
  // choice in the UI rather than a gap. Only ever used to select the
  // sex-specific WHO growth reference (W-10). `@IsIn` over the enum's values
  // instead of `@IsEnum`, because this DTO is populated from
  // `multipart/form-data` where every field arrives as a string.
  //
  // `CLEAR_CHILD_SEX` (the empty string) is accepted as well and treated as
  // "not specified": a `multipart` field cannot carry `null`, so a client that
  // sends the field unconditionally would otherwise get a 400 for the most
  // common case of all — creating a child without stating a sex.
  @IsOptional()
  @IsIn([...Object.values(ChildSex), CLEAR_CHILD_SEX])
  sex?: string;
}
