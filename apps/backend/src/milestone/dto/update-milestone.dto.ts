import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsDateOnly } from '../../common/validators/is-date-only.validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';
import { MilestoneCategory } from '../milestone-category.enum';
import { MAX_MILESTONE_TITLE_LENGTH, MAX_NOTE_LENGTH } from '../milestone.constants';

/**
 * Request body for `PATCH .../milestones/:id` — genuinely partial: every field
 * is optional and an absent key leaves the stored value untouched.
 *
 * The nullable fields distinguish "don't touch" (key absent) from "clear it"
 * (explicit `null`), the same way `UpdateGrowthMeasurementDto` does.
 *
 * `templateKey` is deliberately **not** editable. It is the identity of a
 * template entry and the key the uniqueness rule (M-5) hangs off; turning a
 * template entry into a free one (or into a different template) is a delete
 * plus a create, not an edit. `title` and `category` are exposed here but the
 * service rejects changing them on a *template* entry, where both are owned by
 * the catalog — see `MilestoneService.update()`.
 *
 * There is also no `clientTimestamp`: milestones are online-only (M-15), so
 * ADR-0011's Last-Write-Wins handling does not apply.
 */
export class UpdateMilestoneDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MILESTONE_TITLE_LENGTH)
  title?: string;

  // `null` clears the category of a free entry.
  @IsOptional()
  @ValidateIf((dto: UpdateMilestoneDto) => dto.category !== null)
  @IsEnum(MilestoneCategory)
  category?: MilestoneCategory | null;

  // Same bare calendar day (`YYYY-MM-DD`) as on create — see that DTO.
  @IsOptional()
  @IsDateOnly()
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  achievedAt?: string;

  @IsOptional()
  @ValidateIf((dto: UpdateMilestoneDto) => dto.note !== null)
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string | null;
}
