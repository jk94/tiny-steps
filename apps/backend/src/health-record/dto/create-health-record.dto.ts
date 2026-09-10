import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsDateOnly } from '../../common/validators/is-date-only.validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';
import { HealthRecordKind } from '../health-record-kind.enum';
import {
  MAX_DOSE_UNIT_LENGTH,
  MAX_HEALTH_RECORD_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_VACCINE_BATCH_LENGTH,
} from '../health-record.constants';

/**
 * Request body for `POST .../health-records`.
 *
 * Deliberately only checks what a single field can decide on its own. Every
 * cross-column rule lives in `HealthRecordService`, which is the only place
 * that can see the merged result and the child:
 * - MED-2 ("at least one of `administeredAt`/`dueAt`")
 * - MED-3 ("a dose needs a unit")
 * - the per-`kind` field validity behind MED-3/MED-4
 * - the "not before the child's birth date" half of MED-6
 */
export class CreateHealthRecordDto {
  // Immutable once created — there is no `kind` on the update DTO. Turning a
  // medication into a vaccination would invalidate the kind-specific columns
  // already stored, so it is a delete plus a create.
  @IsEnum(HealthRecordKind)
  kind!: HealthRecordKind;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_HEALTH_RECORD_NAME_LENGTH)
  name!: string;

  // A real instant, not a calendar day: several doses can fall on one day and
  // the time of each is exactly what matters then. Must not be in the future
  // (MED-6) — an entry is either something that happened or a plan, and a plan
  // uses `dueAt`.
  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  administeredAt?: string;

  // A bare calendar day (`YYYY-MM-DD`), stored like `Child.birthDate` — an
  // appointment is agreed on a day, never on a minute. Deliberately NOT
  // range-restricted: a past due date is a legitimate, overdue entry (MED-6).
  @IsOptional()
  @IsDateOnly()
  @IsISO8601({ strict: true })
  dueAt?: string;

  // Only meaningful for a medication; `@IsPositive` because a zero or negative
  // dose is never a real administration.
  @IsOptional()
  @IsNumber()
  @IsPositive()
  doseAmount?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_DOSE_UNIT_LENGTH)
  doseUnit?: string;

  // Only meaningful for a vaccination (MED-4).
  @IsOptional()
  @IsString()
  @MaxLength(MAX_VACCINE_BATCH_LENGTH)
  vaccineBatch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;

  // Opt-in (MED-7). Defaulted to false by the schema, so recording a dose that
  // already happened never schedules a push.
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;
}
