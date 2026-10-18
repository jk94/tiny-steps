import type { DevelopmentContent, DevelopmentEntry } from './content/types';
import { FIRST_MONTH_STAGE, type DevelopmentStage } from './developmentStage';

export type DevelopmentLocale = 'de' | 'en';

/**
 * Maps i18next's resolved language onto a content locale. Anything that is not
 * English gets German, matching the app's `fallbackLng`.
 */
export function toDevelopmentLocale(language: string | undefined): DevelopmentLocale {
  return language?.startsWith('en') ? 'en' : 'de';
}

/**
 * Loads one locale's calendar as its own chunk.
 *
 * The texts are deliberately NOT part of `de.json`/`en.json`: those are bundled
 * statically into the entry chunk for both languages, and 76 stages of prose
 * per language would roughly double their size for a screen most visits never
 * open. A dynamic import keeps them out of the entry chunk, loads only the
 * active language, and still works offline — the service worker precaches
 * every built chunk, not just the entry.
 */
export async function loadDevelopmentContent(
  locale: DevelopmentLocale,
): Promise<DevelopmentContent> {
  const module = locale === 'en' ? await import('./content/en') : await import('./content/de');
  return module.developmentContent;
}

/** The entry for a stage. Positional — see `DevelopmentContent`. */
export function developmentEntryFor(
  content: DevelopmentContent,
  stage: DevelopmentStage,
): DevelopmentEntry | undefined {
  return stage.kind === 'week'
    ? content.weeks[stage.number - 1]
    : content.months[stage.number - FIRST_MONTH_STAGE];
}
