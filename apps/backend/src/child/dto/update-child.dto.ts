import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';
import { ChildSex } from '../child-sex.enum';

/**
 * Sent to reset `sex` back to "not specified". A `multipart/form-data` field
 * cannot carry JSON `null`, so the empty string is the wire representation of
 * "clear it" — `ChildService.update` maps it to a NULL column.
 */
export const CLEAR_CHILD_SEX = '';

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

  // Absent leaves the stored value untouched; `CLEAR_CHILD_SEX` resets it to
  // "not specified" (see that constant). Percentiles then disappear again with
  // an explanatory hint rather than falling back to a guessed default (W-10).
  @IsOptional()
  @IsIn([...Object.values(ChildSex), CLEAR_CHILD_SEX])
  sex?: string;
}
