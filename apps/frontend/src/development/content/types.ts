import type { DevelopmentSourceId } from '../developmentSources';

/**
 * One stage's text in one language.
 *
 * - `teaser` is what the dashboard card shows: one or two sentences, readable
 *   at a glance.
 * - `body` holds the detail screen's paragraphs. Ages are phrased as spans
 *   ("around now", "between X and Y months"), never as deadlines — the same
 *   posture as the milestone catalog (M-3).
 * - `tips` are concrete things to try or to keep in mind this week/month.
 * - `sources` point into `DEVELOPMENT_SOURCES`; each locale picks sources in
 *   its own language first.
 */
export interface DevelopmentEntry {
  title: string;
  teaser: string;
  body: readonly string[];
  tips: readonly string[];
  sources: readonly DevelopmentSourceId[];
}

/**
 * A full locale's calendar. Plain arrays indexed by position rather than maps
 * keyed by stage: `weeks[0]` is Lebenswoche 1, `months[0]` is Lebensmonat 13.
 * `developmentContent.spec.ts` pins both lengths for every locale, which is
 * what makes the positional lookup safe.
 */
export interface DevelopmentContent {
  weeks: readonly DevelopmentEntry[];
  months: readonly DevelopmentEntry[];
}
