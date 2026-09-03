import {
  IsBoolean,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsDateOnly } from '../../common/validators/is-date-only.validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';
import { ValidateIfDefined } from '../../common/validators/validate-if-defined.decorator';
import {
  MAX_DOSE_UNIT_LENGTH,
  MAX_HEALTH_RECORD_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_VACCINE_BATCH_LENGTH,
} from '../health-record.constants';

/**
 * Request body for `PATCH .../health-records/:id` — genuinely partial: every
 * field is optional and an absent key leaves the stored value untouched.
 *
 * The nullable fields distinguish "don't touch" (key absent) from "clear it"
 * (explicit `null`), the same way `UpdateMilestoneDto` does. This is also the
 * DTO behind "mark as done" (MED-5): that action is nothing more than a PATCH
 * carrying `administeredAt`, which keeps the result editable afterwards
 * instead of being a one-way state transition.
 *
 * `kind` is deliberately absent — it is the identity of the record and decides
 * which of the optional columns are even legal, so changing it is a delete plus
 * a create.
 *
 * There is also no `clientTimestamp`: health records are online-only (MED-15),
 * so ADR-0011's Last-Write-Wins handling does not apply.
 */
export class UpdateHealthRecordDto {
  // Not nullable: a record without a name is not a record.
  @ValidateIfDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_HEALTH_RECORD_NAME_LENGTH)
  name?: string;

  // `null` reverts a "done" entry back to merely planned.
  @IsOptional()
  @ValidateIf((dto: UpdateHealthRecordDto) => dto.administeredAt !== null)
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  administeredAt?: string | null;

  // `null` drops the planned appointment, leaving a pure history entry.
  @IsOptional()
  @ValidateIf((dto: UpdateHealthRecordDto) => dto.dueAt !== null)
  @IsDateOnly()
  @IsISO8601({ strict: true })
  dueAt?: string | null;

  @IsOptional()
  @ValidateIf((dto: UpdateHealthRecordDto) => dto.doseAmount !== null)
  @IsNumber()
  @IsPositive()
  doseAmount?: number | null;

  @IsOptional()
  @ValidateIf((dto: UpdateHealthRecordDto) => dto.doseUnit !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_DOSE_UNIT_LENGTH)
  doseUnit?: string | null;

  @IsOptional()
  @ValidateIf((dto: UpdateHealthRecordDto) => dto.vaccineBatch !== null)
  @IsString()
  @MaxLength(MAX_VACCINE_BATCH_LENGTH)
  vaccineBatch?: string | null;

  @IsOptional()
  @ValidateIf((dto: UpdateHealthRecordDto) => dto.note !== null)
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string | null;

  // Not nullable either — the column has no "unset" state, only true/false.
  @ValidateIfDefined()
  @IsBoolean()
  reminderEnabled?: boolean;
}
