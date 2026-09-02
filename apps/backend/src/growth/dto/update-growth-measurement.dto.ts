import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsDateOnly } from '../../common/validators/is-date-only.validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';
import {
  MAX_HEAD_CIRCUMFERENCE_MILLIMETERS,
  MAX_LENGTH_MILLIMETERS,
  MAX_NOTE_LENGTH,
  MAX_WEIGHT_GRAMS,
  MIN_HEAD_CIRCUMFERENCE_MILLIMETERS,
  MIN_LENGTH_MILLIMETERS,
  MIN_WEIGHT_GRAMS,
} from '../growth-measurement.constants';
import { LengthMeasurementPosition } from '../length-measurement-position.enum';

/**
 * Request body for `PATCH .../growth/:id` — genuinely partial: every field is
 * optional and an absent key leaves the stored value untouched.
 *
 * The nullable fields distinguish "don't touch" (key absent) from "clear it"
 * (explicit `null`), the same way `UpdateFeedingEventDto.note` does. Clearing
 * a value is a real operation here: a parent who mistyped a head circumference
 * must be able to remove it again without deleting the whole measurement.
 *
 * There is deliberately **no** class-level "at least one value" check (W-1):
 * a PATCH may legitimately touch only the note or the date, so the rule can
 * only be evaluated against the merged result — `GrowthService.update()` does
 * that after loading the stored row.
 *
 * There is also no `clientTimestamp`: growth tracking is online-only (W-16),
 * so ADR-0011's Last-Write-Wins handling does not apply.
 */
export class UpdateGrowthMeasurementDto {
  // Same bare calendar day (`YYYY-MM-DD`) as on create — see that DTO.
  @IsOptional()
  @IsDateOnly()
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  measuredAt?: string;

  @IsOptional()
  @ValidateIf((dto: UpdateGrowthMeasurementDto) => dto.weightGrams !== null)
  @IsInt()
  @Min(MIN_WEIGHT_GRAMS)
  @Max(MAX_WEIGHT_GRAMS)
  weightGrams?: number | null;

  @IsOptional()
  @ValidateIf((dto: UpdateGrowthMeasurementDto) => dto.lengthMillimeters !== null)
  @IsInt()
  @Min(MIN_LENGTH_MILLIMETERS)
  @Max(MAX_LENGTH_MILLIMETERS)
  lengthMillimeters?: number | null;

  @IsOptional()
  @ValidateIf((dto: UpdateGrowthMeasurementDto) => dto.headCircumferenceMillimeters !== null)
  @IsInt()
  @Min(MIN_HEAD_CIRCUMFERENCE_MILLIMETERS)
  @Max(MAX_HEAD_CIRCUMFERENCE_MILLIMETERS)
  headCircumferenceMillimeters?: number | null;

  // `null` clears the manual override and returns the measurement to the
  // age-based automatic choice (W-17/W-18).
  @IsOptional()
  @ValidateIf((dto: UpdateGrowthMeasurementDto) => dto.lengthMeasurementPosition !== null)
  @IsEnum(LengthMeasurementPosition)
  lengthMeasurementPosition?: LengthMeasurementPosition | null;

  @IsOptional()
  @ValidateIf((dto: UpdateGrowthMeasurementDto) => dto.note !== null)
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string | null;
}
