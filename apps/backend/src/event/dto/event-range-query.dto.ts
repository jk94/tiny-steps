import { IsISO8601 } from 'class-validator';

/**
 * Query params for `GET .../events/daily` and `GET .../events/stats`.
 * `from`/`to` are full ISO-8601 UTC instants (not bare dates) forming a
 * `[from, to)` range — the frontend is responsible for computing local-day
 * boundaries (see `apps/frontend/src/lib/dayBoundaries.ts`) and sending them
 * as instants; this backend does zero timezone reasoning, it just uses the
 * two instants literally in a Prisma `gte`/`lt` filter (see
 * `EventService.listDaily`).
 */
export class EventRangeQueryDto {
  @IsISO8601({ strict: true })
  from!: string;

  @IsISO8601({ strict: true })
  to!: string;
}
