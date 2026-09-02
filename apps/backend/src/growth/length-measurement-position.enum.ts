/**
 * How a body measurement was taken: recumbent (`LYING`) or standing
 * (`STANDING`).
 *
 * Stored on `GrowthMeasurement.lengthMeasurementPosition` as a **manual
 * override** of the age-based WHO choice (W-18). `null` there means "derive
 * automatically from the age at measurement time" (W-17) — a first-class
 * state, not a missing value — which is why there is no `AUTO` member here.
 *
 * Persisted as a plain `String`, not a Prisma `enum`, because Prisma's `enum`
 * type is not supported on the SQLite connector (same rationale as
 * `FeedingType`/`HouseholdRole`; see ADR-0002). Read via
 * `toLengthMeasurementPosition()` rather than comparing raw strings.
 */
export enum LengthMeasurementPosition {
  LYING = 'LYING',
  STANDING = 'STANDING',
}

/**
 * Validates and casts a raw string (e.g. read from
 * `GrowthMeasurement.lengthMeasurementPosition`) into a
 * `LengthMeasurementPosition`. Throws on anything else — the defensive
 * boundary that makes up for the untyped DB column. Only call this on a
 * non-null value.
 */
export function toLengthMeasurementPosition(value: string): LengthMeasurementPosition {
  if (isLengthMeasurementPosition(value)) {
    return value;
  }
  throw new Error(`Invalid LengthMeasurementPosition: ${value}`);
}

function isLengthMeasurementPosition(value: string): value is LengthMeasurementPosition {
  return Object.values(LengthMeasurementPosition).includes(value as LengthMeasurementPosition);
}
