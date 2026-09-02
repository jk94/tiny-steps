import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
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
import { AtLeastOneMeasurementValue } from '../validators/at-least-one-measurement-value.validator';

/**
 * Request body for `POST .../growth`.
 *
 * Values arrive already converted to the internal base units — integer grams
 * and integer millimetres (W-3). The familiar kg/cm input and its conversion
 * are a frontend concern; the API deliberately never accepts floats, so a
 * value cannot drift through rounding on the way in.
 *
 * The "not before the child's birth date" half of W-5 is *not* checked here:
 * this DTO has no access to the child. `GrowthService.create` enforces it.
 */
export class CreateGrowthMeasurementDto {
  // `@AtLeastOneMeasurementValue` (W-1) is attached to this required field on
  // purpose — see the validator's doc comment.
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  @AtLeastOneMeasurementValue()
  measuredAt!: string;

  @IsOptional()
  @IsInt()
  @Min(MIN_WEIGHT_GRAMS)
  @Max(MAX_WEIGHT_GRAMS)
  weightGrams?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_LENGTH_MILLIMETERS)
  @Max(MAX_LENGTH_MILLIMETERS)
  lengthMillimeters?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_HEAD_CIRCUMFERENCE_MILLIMETERS)
  @Max(MAX_HEAD_CIRCUMFERENCE_MILLIMETERS)
  headCircumferenceMillimeters?: number;

  // Absent means "derive the reference from the age at measurement time"
  // (W-17); present overrides that choice permanently (W-18).
  @IsOptional()
  @IsEnum(LengthMeasurementPosition)
  lengthMeasurementPosition?: LengthMeasurementPosition;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;
}
