import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { DiaperType } from '../diaper-type.enum';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';

const MAX_NOTE_LENGTH = 500;

/**
 * Request body for `PATCH .../diaper-events/:eventId`. All fields
 * optional (partial-update semantics).
 *
 * Deliberate deviation from Feeding: `diaperType` IS editable here, unlike
 * `UpdateFeedingEventDto.feedingType`, which is immutable.
 * `UpdateFeedingEventDto` makes `feedingType` immutable because changing
 * it would orphan sub-type-only fields (`side` for BREAST, `amountMl` for
 * BOTTLE) with no clear rule for what happens to them. Diaper has no such
 * field — `note` applies uniformly to `PEE`/`STOOL`/`BOTH` — so there's no
 * orphaning risk, and forcing delete+recreate just to correct "Pipi" ->
 * "beides" would be worse UX for no safety benefit.
 */
export class UpdateDiaperEventDto {
  @IsOptional()
  @IsEnum(DiaperType)
  diaperType?: DiaperType;

  @IsOptional()
  @IsISO8601({ strict: true })
  @IsNotFutureDate()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;
}
