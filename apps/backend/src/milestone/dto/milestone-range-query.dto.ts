import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Query params for `GET .../milestones`. Both bounds are optional — omitting
 * them lists the child's full milestone history, which is the normal case for
 * a timeline. When given, they are full ISO-8601 UTC instants forming a
 * `[from, to)` range on `achievedAt`, used literally in a Prisma `gte`/`lt`
 * filter; this backend does zero timezone reasoning (same contract as
 * `GrowthRangeQueryDto`/`ExportQueryDto`).
 */
export class MilestoneRangeQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
