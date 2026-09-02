/**
 * Developmental area a milestone belongs to (M-3).
 *
 * Used for grouping and colour-coding only — explicitly **not** an assessment:
 * the app never tells a parent their child is "behind" in a category. For
 * template entries the value is derived server-side from
 * `MILESTONE_CATALOG`; for free entries it is an optional user choice, so
 * `null` on the column is a legitimate state.
 *
 * Persisted as a plain `String` column on `Milestone.category`, not a Prisma
 * `enum`, for the same reason as `MilestoneTemplate`/`ChildSex` (SQLite
 * connector; see ADR-0002). Always read through `toMilestoneCategory()`.
 */
export enum MilestoneCategory {
  MOTOR = 'MOTOR',
  LANGUAGE = 'LANGUAGE',
  SOCIAL = 'SOCIAL',
  PHYSICAL = 'PHYSICAL',
}

/**
 * Validates and casts a raw string (e.g. read from `Milestone.category`) into
 * a `MilestoneCategory`. Throws on any unknown value — the defensive boundary
 * making up for the DB column not being type-checked at the schema level. Only
 * call this on a non-null value; `null` means "no category" and must be
 * handled by the caller.
 */
export function toMilestoneCategory(value: string): MilestoneCategory {
  if (isMilestoneCategory(value)) {
    return value;
  }
  throw new Error(`Invalid MilestoneCategory: ${value}`);
}

export function isMilestoneCategory(value: string): value is MilestoneCategory {
  return Object.values(MilestoneCategory).includes(value as MilestoneCategory);
}
