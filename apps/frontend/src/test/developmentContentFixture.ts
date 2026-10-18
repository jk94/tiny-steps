import type { DevelopmentContent, DevelopmentEntry } from '../development/content/types';
import {
  FIRST_MONTH_STAGE,
  FIRST_YEAR_WEEKS,
  LAST_MONTH_STAGE,
} from '../development/developmentStage';

/**
 * A complete, recognisable stand-in for a locale's calendar, so component
 * specs assert against their own fixture text rather than against prose that
 * will keep being edited.
 */
function fixtureEntry(label: string): DevelopmentEntry {
  return {
    title: `Title ${label}`,
    teaser: `Teaser ${label}`,
    body: [`Body ${label} one`, `Body ${label} two`],
    tips: [`Tip ${label} one`, `Tip ${label} two`],
    sources: ['kgiFirstYear', 'cdc2Months'],
  };
}

export const fixtureDevelopmentContent: DevelopmentContent = {
  weeks: Array.from({ length: FIRST_YEAR_WEEKS }, (_, i) => fixtureEntry(`week-${i + 1}`)),
  months: Array.from({ length: LAST_MONTH_STAGE - FIRST_MONTH_STAGE + 1 }, (_, i) =>
    fixtureEntry(`month-${FIRST_MONTH_STAGE + i}`),
  ),
};
