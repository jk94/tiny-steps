import { MilestoneCategory } from './milestone-category.enum';
import { MilestoneTemplate } from './milestone-template.enum';

/**
 * One template of the milestone catalog: a stable key, the developmental area
 * it belongs to, and the age span it typically falls in.
 *
 * `typicalAgeMonths` is an inclusive `[min, max]` **spread for orientation**,
 * never a target (M-3). The UI phrases it as "usually between X and Y months"
 * and marks nothing as overdue — a milestone the child has not reached is
 * simply one that has not been recorded yet.
 */
export interface MilestoneCatalogEntry {
  key: MilestoneTemplate;
  category: MilestoneCategory;
  typicalAgeMonths: readonly [number, number];
}

/**
 * The 20 catalog templates spanning the first three years.
 *
 * The catalog lives **in code, not in the database**: it changes only with a
 * release, its labels are translations of the keys below (so there is nothing
 * language-specific to store), and it needs no operator upkeep — a DB table
 * would add a seeding/migration burden and a divergence risk between
 * deployments for zero benefit. It is deliberately not served over the API
 * either; the frontend carries the same list and the backend only validates
 * against the keys. (No ADR: the decision is small and uncontested — see the
 * implementation PR for Phase 7.2.)
 *
 * Deliberately absent: "sleeps through the night". It scatters enormously,
 * barely depends on the child, and as a template mostly serves to make parents
 * feel bad — anyone who wants to record it can create a free entry.
 */
export const MILESTONE_CATALOG: readonly MilestoneCatalogEntry[] = [
  {
    key: MilestoneTemplate.FIRST_SMILE,
    category: MilestoneCategory.SOCIAL,
    typicalAgeMonths: [1, 3],
  },
  {
    key: MilestoneTemplate.HOLDS_HEAD_UP,
    category: MilestoneCategory.MOTOR,
    typicalAgeMonths: [2, 4],
  },
  {
    key: MilestoneTemplate.FIRST_LAUGH,
    category: MilestoneCategory.SOCIAL,
    typicalAgeMonths: [3, 5],
  },
  {
    key: MilestoneTemplate.GRASPS_OBJECT,
    category: MilestoneCategory.MOTOR,
    typicalAgeMonths: [3, 6],
  },
  {
    key: MilestoneTemplate.ROLLS_OVER,
    category: MilestoneCategory.MOTOR,
    typicalAgeMonths: [4, 7],
  },
  {
    key: MilestoneTemplate.FIRST_SOLID_FOOD,
    category: MilestoneCategory.PHYSICAL,
    typicalAgeMonths: [5, 8],
  },
  {
    key: MilestoneTemplate.BABBLES,
    category: MilestoneCategory.LANGUAGE,
    typicalAgeMonths: [5, 9],
  },
  {
    key: MilestoneTemplate.FIRST_TOOTH,
    category: MilestoneCategory.PHYSICAL,
    typicalAgeMonths: [4, 10],
  },
  {
    key: MilestoneTemplate.SITS_UNSUPPORTED,
    category: MilestoneCategory.MOTOR,
    typicalAgeMonths: [6, 9],
  },
  { key: MilestoneTemplate.CRAWLS, category: MilestoneCategory.MOTOR, typicalAgeMonths: [7, 11] },
  {
    key: MilestoneTemplate.PULLS_TO_STAND,
    category: MilestoneCategory.MOTOR,
    typicalAgeMonths: [8, 12],
  },
  {
    key: MilestoneTemplate.WAVES_BYE,
    category: MilestoneCategory.SOCIAL,
    typicalAgeMonths: [9, 13],
  },
  {
    key: MilestoneTemplate.FIRST_WORD,
    category: MilestoneCategory.LANGUAGE,
    typicalAgeMonths: [10, 15],
  },
  {
    key: MilestoneTemplate.FIRST_STEPS,
    category: MilestoneCategory.MOTOR,
    typicalAgeMonths: [11, 16],
  },
  {
    key: MilestoneTemplate.DRINKS_FROM_CUP,
    category: MilestoneCategory.PHYSICAL,
    typicalAgeMonths: [12, 18],
  },
  {
    key: MilestoneTemplate.CLIMBS_STAIRS,
    category: MilestoneCategory.MOTOR,
    typicalAgeMonths: [14, 22],
  },
  { key: MilestoneTemplate.RUNS, category: MilestoneCategory.MOTOR, typicalAgeMonths: [18, 24] },
  {
    key: MilestoneTemplate.TWO_WORD_SENTENCE,
    category: MilestoneCategory.LANGUAGE,
    typicalAgeMonths: [18, 26],
  },
  {
    key: MilestoneTemplate.SAYS_OWN_NAME,
    category: MilestoneCategory.LANGUAGE,
    typicalAgeMonths: [24, 30],
  },
  {
    key: MilestoneTemplate.POTTY_TRAINED_DAY,
    category: MilestoneCategory.PHYSICAL,
    typicalAgeMonths: [24, 36],
  },
];

const CATALOG_BY_KEY = new Map<MilestoneTemplate, MilestoneCatalogEntry>(
  MILESTONE_CATALOG.map((entry) => [entry.key, entry]),
);

/**
 * The catalog entry for a template key. Throws if the key is missing from the
 * catalog — that would mean the enum and the catalog have drifted apart, which
 * is a programming error rather than bad input (`toMilestoneTemplate()` has
 * already rejected genuinely unknown keys by this point).
 */
export function getMilestoneCatalogEntry(key: MilestoneTemplate): MilestoneCatalogEntry {
  const entry = CATALOG_BY_KEY.get(key);
  if (!entry) {
    throw new Error(`Missing milestone catalog entry for template: ${key}`);
  }
  return entry;
}
