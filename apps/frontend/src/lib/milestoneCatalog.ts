import type { ParseKeys } from 'i18next';
import type { MilestoneCategory } from '../api/milestone-api';

/**
 * One template of the milestone catalog: a stable key, its developmental area
 * and the age span it typically falls in.
 *
 * `typicalAgeMonths` is an inclusive `[min, max]` **spread for orientation**,
 * never a target (M-3). The catalog view phrases it as "usually between X and
 * Y months" and marks nothing as overdue — a milestone that has not been
 * recorded is simply one that has not been recorded.
 */
export interface MilestoneTemplateEntry {
  key: string;
  category: MilestoneCategory;
  typicalAgeMonths: readonly [number, number];
}

/**
 * The 20 catalog templates, mirroring
 * `apps/backend/src/milestone/milestone-catalog.ts` by value.
 *
 * Duplicated rather than served over the API on purpose: the catalog changes
 * only with a release, the backend only ever validates the *keys*, and the
 * display texts live in the i18n resources under `milestone.templates.<KEY>`
 * anyway — so an endpoint would ship a payload the client already has. Any
 * change here has to be made on the backend side too.
 *
 * Note that this list only drives the catalog view and prefills the create
 * form. It never renders a *stored* milestone: those carry their own frozen
 * `title` (see the backend schema).
 */
export const MILESTONE_TEMPLATES: readonly MilestoneTemplateEntry[] = [
  { key: 'FIRST_SMILE', category: 'SOCIAL', typicalAgeMonths: [1, 3] },
  { key: 'HOLDS_HEAD_UP', category: 'MOTOR', typicalAgeMonths: [2, 4] },
  { key: 'FIRST_LAUGH', category: 'SOCIAL', typicalAgeMonths: [3, 5] },
  { key: 'GRASPS_OBJECT', category: 'MOTOR', typicalAgeMonths: [3, 6] },
  { key: 'ROLLS_OVER', category: 'MOTOR', typicalAgeMonths: [4, 7] },
  { key: 'FIRST_SOLID_FOOD', category: 'PHYSICAL', typicalAgeMonths: [5, 8] },
  { key: 'BABBLES', category: 'LANGUAGE', typicalAgeMonths: [5, 9] },
  { key: 'FIRST_TOOTH', category: 'PHYSICAL', typicalAgeMonths: [4, 10] },
  { key: 'SITS_UNSUPPORTED', category: 'MOTOR', typicalAgeMonths: [6, 9] },
  { key: 'CRAWLS', category: 'MOTOR', typicalAgeMonths: [7, 11] },
  { key: 'PULLS_TO_STAND', category: 'MOTOR', typicalAgeMonths: [8, 12] },
  { key: 'WAVES_BYE', category: 'SOCIAL', typicalAgeMonths: [9, 13] },
  { key: 'FIRST_WORD', category: 'LANGUAGE', typicalAgeMonths: [10, 15] },
  { key: 'FIRST_STEPS', category: 'MOTOR', typicalAgeMonths: [11, 16] },
  { key: 'DRINKS_FROM_CUP', category: 'PHYSICAL', typicalAgeMonths: [12, 18] },
  { key: 'CLIMBS_STAIRS', category: 'MOTOR', typicalAgeMonths: [14, 22] },
  { key: 'RUNS', category: 'MOTOR', typicalAgeMonths: [18, 24] },
  { key: 'TWO_WORD_SENTENCE', category: 'LANGUAGE', typicalAgeMonths: [18, 26] },
  { key: 'SAYS_OWN_NAME', category: 'LANGUAGE', typicalAgeMonths: [24, 30] },
  { key: 'POTTY_TRAINED_DAY', category: 'PHYSICAL', typicalAgeMonths: [24, 36] },
];

/**
 * The catalog entry for a key, or `undefined` for a key this build does not
 * know. Undefined rather than throwing: a stored milestone may carry a
 * template key from a newer release, and its own frozen title still renders
 * fine without a catalog entry.
 */
export function getTemplateEntry(key: string): MilestoneTemplateEntry | undefined {
  return MILESTONE_TEMPLATES.find((entry) => entry.key === key);
}

/**
 * The i18n key holding a template's label.
 *
 * The one place in the app that builds a `milestone.templates.*` key from a
 * runtime string, so the unavoidable cast lives here instead of at every call
 * site: `ParseKeys` is a union of the literal keys in `de.json`, which a
 * template literal cannot narrow to. `milestoneCatalog.spec.ts` pins the
 * catalog against those translations in both directions, which is what
 * actually makes this safe.
 */
export function milestoneTemplateLabelKey(key: string): ParseKeys {
  return `milestone.templates.${key}` as ParseKeys;
}

/**
 * Age buckets the catalog view groups by, in months. Chosen to match how the
 * first three years are usually talked about (half-year steps until two, then
 * a wider final band) rather than to spread the 20 entries evenly.
 */
export const MILESTONE_AGE_BUCKETS: readonly { minMonths: number; maxMonths: number }[] = [
  { minMonths: 0, maxMonths: 6 },
  { minMonths: 6, maxMonths: 12 },
  { minMonths: 12, maxMonths: 18 },
  { minMonths: 18, maxMonths: 24 },
  { minMonths: 24, maxMonths: 36 },
];

/**
 * Groups the catalog into the age buckets above, keyed on each template's
 * *lower* bound so an entry appears exactly once, in the bucket where a parent
 * would first start looking for it. Entries stay sorted by that lower bound.
 */
export function groupTemplatesByAgeBucket(): {
  bucket: (typeof MILESTONE_AGE_BUCKETS)[number];
  templates: MilestoneTemplateEntry[];
}[] {
  const sorted = [...MILESTONE_TEMPLATES].sort(
    (a, b) => a.typicalAgeMonths[0] - b.typicalAgeMonths[0],
  );

  return MILESTONE_AGE_BUCKETS.map((bucket, index) => {
    const isLastBucket = index === MILESTONE_AGE_BUCKETS.length - 1;
    return {
      bucket,
      templates: sorted.filter((entry) => {
        const lowerBound = entry.typicalAgeMonths[0];
        if (lowerBound < bucket.minMonths) {
          return false;
        }
        // Half-open buckets, except the last one, which is closed at the top
        // so an entry starting exactly at 36 months cannot fall out of the
        // catalog entirely.
        return isLastBucket ? lowerBound <= bucket.maxMonths : lowerBound < bucket.maxMonths;
      }),
    };
  });
}
