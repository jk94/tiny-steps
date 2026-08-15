import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Query params for `GET .../export/json` and `GET .../export/csv`.
 * Unlike `EventRangeQueryDto` (where `from`/`to` are required, since a
 * daily view is always bounded), the export's date filter is deliberately
 * *optional* — omitting both exports the child's full history. When given,
 * both are full ISO-8601 UTC instants forming a `[from, to)` range, used
 * literally in a Prisma `gte`/`lt` filter (see `ExportService.getRawEvents`);
 * this backend does zero timezone reasoning.
 */
export class ExportQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
