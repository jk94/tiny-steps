/**
 * What a health record documents (MED-1): a medication administration or a
 * vaccination.
 *
 * The two share one table and differ only in which optional columns they may
 * carry — dose amount/unit for a medication, the vaccine/batch designation for
 * a vaccination (see `HealthRecord` in `schema.prisma`). This enum is what the
 * service branches on to enforce that.
 *
 * Persisted as a plain `String` column on `HealthRecord.kind`, not a Prisma
 * `enum`, for the same reason as `MilestoneCategory`/`ChildSex` (SQLite
 * connector; see ADR-0002). Always read through `toHealthRecordKind()`.
 */
export enum HealthRecordKind {
  MEDICATION = 'MEDICATION',
  VACCINATION = 'VACCINATION',
}

/**
 * Validates and casts a raw string (e.g. read from `HealthRecord.kind`) into a
 * `HealthRecordKind`. Throws on any unknown value — the defensive boundary
 * making up for the DB column not being type-checked at the schema level.
 */
export function toHealthRecordKind(value: string): HealthRecordKind {
  if (isHealthRecordKind(value)) {
    return value;
  }
  throw new Error(`Invalid HealthRecordKind: ${value}`);
}

export function isHealthRecordKind(value: string): value is HealthRecordKind {
  return Object.values(HealthRecordKind).includes(value as HealthRecordKind);
}
