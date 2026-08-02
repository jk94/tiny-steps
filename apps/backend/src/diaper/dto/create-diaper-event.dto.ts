import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { DiaperType } from '../diaper-type.enum';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';

const MAX_NOTE_LENGTH = 500;

/**
 * Request body for `POST .../diaper-events`. Diaper is always a point
 * event — there is no `startedAt`/`endedAt` at all, unlike Feeding/Sleep,
 * since Diaper is never timer-based (see `DiaperService`'s doc comment).
 * `note` is unconditionally optional regardless of `diaperType` (no
 * `@ValidateIf` needed, unlike `CreateFeedingEventDto`'s `side`/`amountMl`
 * — there is no diaperType this field is irrelevant for).
 */
export class CreateDiaperEventDto {
  @IsEnum(DiaperType)
  diaperType!: DiaperType;

  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;
}
