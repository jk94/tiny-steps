import { IsISO8601, IsOptional } from 'class-validator';
import { IsEndNotBeforeStart } from '../validators/is-end-not-before-start.validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';

/**
 * Request body for `PATCH .../sleep-events/:eventId`. Structurally identical
 * to `CreateSleepEventDto` — there's no field to omit here (unlike
 * `UpdateFeedingEventDto` omitting `feedingType`, Sleep has no immutable
 * discriminant field). Kept as a separate class only for symmetry with the
 * create/update split, mirroring `UpdateFeedingEventDto`'s own pattern, not
 * because the two shapes are expected to diverge.
 *
 * `@IsEndNotBeforeStart` here only catches the case where a single request
 * supplies both `startedAt` and `endedAt` — `SleepService.update` must
 * separately re-check the merged start/end pair against the existing DB
 * row, since a PATCH may supply only one of the two fields (see its doc
 * comment).
 */
export class UpdateSleepEventDto {
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
}
