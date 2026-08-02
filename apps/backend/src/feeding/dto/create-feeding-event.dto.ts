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
import { FeedingSide } from '../feeding-side.enum';
import { FeedingType } from '../feeding-type.enum';
import { IsEndNotBeforeStart } from '../validators/is-end-not-before-start.validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';

const MIN_AMOUNT_ML = 1;
const MAX_AMOUNT_ML = 2000;
const MAX_NOTE_LENGTH = 500;

/**
 * Request body for `POST .../feeding-events`. Fields irrelevant to the
 * given `feedingType` (e.g. `side` alongside `feedingType: BOTTLE`) are
 * accepted here but silently discarded by `FeedingService`'s mapper, not
 * rejected — this is a trusted authenticated household member, not a
 * security boundary.
 *
 * Time-precedence resolution (`startedAt`/`occurredAt`/`endedAt` defaults,
 * and the active-timer conflict check) happens server-side in
 * `FeedingService.create`, not in this DTO.
 */
export class CreateFeedingEventDto {
  @IsEnum(FeedingType)
  feedingType!: FeedingType;

  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  occurredAt?: string;

  // Only meaningful when feedingType === BREAST; ignored (not persisted)
  // for BOTTLE/SOLID.
  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  startedAt?: string;

  // Only meaningful when feedingType === BREAST; ignored for BOTTLE/SOLID.
  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  @IsEndNotBeforeStart('startedAt')
  endedAt?: string;

  // Required when feedingType === BREAST, ignored otherwise.
  @ValidateIf((dto: CreateFeedingEventDto) => dto.feedingType === FeedingType.BREAST)
  @IsEnum(FeedingSide)
  side?: FeedingSide;

  // Required when feedingType === BOTTLE, ignored otherwise.
  @ValidateIf((dto: CreateFeedingEventDto) => dto.feedingType === FeedingType.BOTTLE)
  @IsInt()
  @Min(MIN_AMOUNT_ML)
  @Max(MAX_AMOUNT_ML)
  amountMl?: number;

  // Unconditionally optional for all feeding types.
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;
}
