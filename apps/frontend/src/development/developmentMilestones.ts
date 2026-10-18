/**
 * Milestone-catalog templates (`lib/milestoneCatalog.ts`) a stage's text talks
 * about, keyed by stage key. The detail screen offers them as "record it as a
 * milestone" shortcuts into the existing create form (`?templateKey=`).
 *
 * Language-neutral on purpose, so it lives beside rather than inside the
 * per-locale content: both locales describe the same development at the same
 * stage, and the link targets must not drift between them.
 * `developmentContent.spec.ts` pins every key against the catalog.
 */
export const DEVELOPMENT_STAGE_MILESTONES: Readonly<Record<string, readonly string[]>> = {
  'week-6': ['FIRST_SMILE'],
  'week-11': ['HOLDS_HEAD_UP'],
  'week-15': ['GRASPS_OBJECT'],
  'week-16': ['FIRST_LAUGH'],
  'week-18': ['ROLLS_OVER'],
  'week-21': ['FIRST_SOLID_FOOD'],
  'week-25': ['FIRST_TOOTH'],
  'week-27': ['BABBLES'],
  'week-30': ['SITS_UNSUPPORTED'],
  'week-34': ['CRAWLS'],
  'week-36': ['PULLS_TO_STAND'],
  'week-41': ['WAVES_BYE'],
  'week-44': ['FIRST_WORD'],
  'week-49': ['FIRST_STEPS'],
  'month-17': ['DRINKS_FROM_CUP'],
  'month-19': ['CLIMBS_STAIRS'],
  'month-23': ['RUNS'],
  'month-24': ['TWO_WORD_SENTENCE'],
  'month-27': ['POTTY_TRAINED_DAY'],
  'month-36': ['SAYS_OWN_NAME'],
};
