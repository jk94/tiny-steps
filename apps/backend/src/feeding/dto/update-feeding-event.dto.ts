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
import { FeedingSide } from '../feeding-side.enum';
import { IsEndNotBeforeStart } from '../validators/is-end-not-before-start.validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';

const MIN_AMOUNT_ML = 1;
const MAX_AMOUNT_ML = 2000;
const MAX_NOTE_LENGTH = 500;

/**
 * Request body for `PATCH .../feeding-events/:eventId`. Same fields as
 * `CreateFeedingEventDto` minus `feedingType`, which is immutable after
 * creation — a miscategorized entry is deleted and recreated, not
 * "retyped", to avoid ambiguity about what happens to `side`/`amountMl`/
 * `note` when the type would change mid-edit. All fields optional
 * (partial-update semantics).
 *
 * `@IsEndNotBeforeStart` here only catches the case where a single request
 * supplies both `startedAt` and `endedAt` — `FeedingService.update` must
 * separately re-check the merged start/end pair against the existing DB
 * row, since a PATCH may supply only one of the two fields (see its doc
 * comment).
 */
export class UpdateFeedingEventDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  occurredAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  startedAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  @IsEndNotBeforeStart('startedAt')
  endedAt?: string;

  @IsOptional()
  @IsEnum(FeedingSide)
  side?: FeedingSide;

  @IsOptional()
  @IsInt()
  @Min(MIN_AMOUNT_ML)
  @Max(MAX_AMOUNT_ML)
  amountMl?: number;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;
}
