import { IsIn } from 'class-validator';
import type { GrowthIndicator } from '../percentiles/growth-percentiles';

/**
 * The indicators the reference-band endpoint can be asked for. Mirrors the
 * `GrowthIndicator` union from the pure percentile module — kept as a runtime
 * array here because `class-validator` needs actual values, and asserted
 * against the union via the `satisfies` clause so the two cannot drift.
 */
export const GROWTH_INDICATORS = [
  'WEIGHT_FOR_AGE',
  'LENGTH_OR_HEIGHT_FOR_AGE',
  'HEAD_CIRCUMFERENCE_FOR_AGE',
] as const satisfies readonly GrowthIndicator[];

/** Query string of `GET .../growth/reference`. */
export class GrowthReferenceQueryDto {
  @IsIn(GROWTH_INDICATORS)
  indicator!: GrowthIndicator;
}
