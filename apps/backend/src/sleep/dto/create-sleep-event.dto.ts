import { IsISO8601, IsOptional } from 'class-validator';
import { IsEndNotBeforeStart } from '../validators/is-end-not-before-start.validator';
import { IsNotFutureDate } from '../../common/validators/is-not-future-date.validator';

/**
 * Request body for `POST .../sleep-events`. Unlike `CreateFeedingEventDto`,
 * there's no `@ValidateIf` conditional validation here — Sleep has only one
 * instance shape (no discriminant sub-type like Feeding's `feedingType`).
 *
 * Time-precedence resolution (`startedAt`/`occurredAt` defaults, and the
 * active-timer conflict check) happens server-side in `SleepService.create`,
 * not in this DTO.
 */
export class CreateSleepEventDto {
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
