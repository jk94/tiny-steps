/**
 * Stable keys of the developmental-milestone template catalog (M-2).
 *
 * The key is the identity of a template and never travels into a translation:
 * German and English labels are two translations of the *same* key, resolved
 * in the frontend's i18n resources (`milestone.templates.<KEY>`). The backend
 * only validates against these values — it never renders a label.
 *
 * Persisted as a plain `String` column on `Milestone.templateKey`, not a
 * Prisma `enum`, because Prisma's `enum` type is not supported on the SQLite
 * connector — permanent, not a migration stepping stone (same rationale as
 * `HouseholdRole`/`FeedingType`/`ChildSex`; see
 * `docs/adr/0002-application-level-household-roles-and-invites.md`). Enforced
 * at the application layer via `toMilestoneTemplate()`; since the DB column is
 * untyped, always read the value through it rather than comparing raw strings.
 *
 * `null` on the column is a first-class state, not a missing value: it marks a
 * free entry (M-4), which is deliberately equal in rank to a template one.
 */
export enum MilestoneTemplate {
  FIRST_SMILE = 'FIRST_SMILE',
  HOLDS_HEAD_UP = 'HOLDS_HEAD_UP',
  FIRST_LAUGH = 'FIRST_LAUGH',
  GRASPS_OBJECT = 'GRASPS_OBJECT',
  ROLLS_OVER = 'ROLLS_OVER',
  FIRST_SOLID_FOOD = 'FIRST_SOLID_FOOD',
  BABBLES = 'BABBLES',
  FIRST_TOOTH = 'FIRST_TOOTH',
  SITS_UNSUPPORTED = 'SITS_UNSUPPORTED',
  CRAWLS = 'CRAWLS',
  PULLS_TO_STAND = 'PULLS_TO_STAND',
  WAVES_BYE = 'WAVES_BYE',
  FIRST_WORD = 'FIRST_WORD',
  FIRST_STEPS = 'FIRST_STEPS',
  DRINKS_FROM_CUP = 'DRINKS_FROM_CUP',
  CLIMBS_STAIRS = 'CLIMBS_STAIRS',
  RUNS = 'RUNS',
  TWO_WORD_SENTENCE = 'TWO_WORD_SENTENCE',
  SAYS_OWN_NAME = 'SAYS_OWN_NAME',
  POTTY_TRAINED_DAY = 'POTTY_TRAINED_DAY',
}

/**
 * Validates and casts a raw string (e.g. read from `Milestone.templateKey`, or
 * arriving in a create request) into a `MilestoneTemplate`. Throws on any
 * unknown key — the defensive boundary making up for the DB column not being
 * type-checked at the schema level. Only call this on a non-null value; `null`
 * means "free entry" and must be handled by the caller.
 */
export function toMilestoneTemplate(value: string): MilestoneTemplate {
  if (isMilestoneTemplate(value)) {
    return value;
  }
  throw new Error(`Invalid MilestoneTemplate: ${value}`);
}

export function isMilestoneTemplate(value: string): value is MilestoneTemplate {
  return Object.values(MilestoneTemplate).includes(value as MilestoneTemplate);
}
