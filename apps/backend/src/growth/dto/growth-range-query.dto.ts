import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Query params for `GET .../growth`. Both bounds are optional — omitting them
 * lists the child's full measurement history, which is the normal case for a
 * trend chart. When given, they are full ISO-8601 UTC instants forming a
 * `[from, to)` range on `measuredAt`, used literally in a Prisma `gte`/`lt`
 * filter; this backend does zero timezone reasoning (same contract as
 * `ExportQueryDto`).
 */
export class GrowthRangeQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
