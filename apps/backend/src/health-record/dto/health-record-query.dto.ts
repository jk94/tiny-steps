import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { HealthRecordKind } from '../health-record-kind.enum';

/** The two states MED-12 splits the overview into. */
export const HEALTH_RECORD_STATUSES = ['planned', 'done'] as const;
export type HealthRecordStatus = (typeof HEALTH_RECORD_STATUSES)[number];

/**
 * Query string of `GET .../health-records`.
 *
 * Both filters are optional and independent; omitting them returns everything,
 * which is what the overview page actually does — it renders both of MED-12's
 * sections from a single fetch rather than issuing two filtered requests.
 *
 * Deliberately no `from`/`to` range filter (unlike milestones and growth):
 * there is no single date column to window on here, since a record is dated by
 * `administeredAt` or by `dueAt` depending on its state.
 */
export class HealthRecordQueryDto {
  @IsOptional()
  @IsEnum(HealthRecordKind)
  kind?: HealthRecordKind;

  // 'planned' = no `administeredAt` yet, 'done' = one is set. Derived from the
  // column rather than stored, so it can never drift from the data.
  @IsOptional()
  @IsIn(HEALTH_RECORD_STATUSES)
  status?: HealthRecordStatus;
}
