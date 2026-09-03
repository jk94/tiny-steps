import de from './de.json';
import en from './en.json';
import type { ReportLocale } from '../report-document.types';

/**
 * The PDF report's own string catalog (EXP-8).
 *
 * Deliberately **not** shared with `apps/frontend/src/i18n/locales/*.json`.
 * Sharing would mean either shipping the frontend's ~1000-key bundle into the
 * backend or extracting a fourth package for ~60 strings, and it would couple
 * the wording of a printed medical document to the wording of a screen that is
 * free to change. Roughly thirty duplicated strings is the cheaper side of that
 * trade — see ADR-0015.
 *
 * Equally deliberate: no i18next here. The report needs key lookup, `{{name}}`
 * interpolation and a two-form plural, and nothing else — no namespaces, no
 * detection, no async loading, no React binding.
 */

/** The default when a locale cannot be honoured — the app's primary language. */
const FALLBACK_LOCALE: ReportLocale = 'de';

const CATALOGS: Record<ReportLocale, Record<string, string>> = { de, en };

type CatalogKey = keyof typeof de;

/**
 * `age.days_one`/`age.days_other` are addressed as `age.days` plus a `count`,
 * so the base name has to be a valid key even though no catalog entry carries
 * it literally.
 */
type PluralBaseKey<Key> = Key extends `${infer Base}_one` ? Base : never;

export type ReportStringKey = CatalogKey | PluralBaseKey<CatalogKey>;

export type InterpolationValues = Record<string, string | number>;

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/** Replaces every `{{name}}` with its value; an unmatched one is left as-is. */
export function format(template: string, values: InterpolationValues = {}): string {
  return template.replace(PLACEHOLDER, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export interface ReportStrings {
  /**
   * Looks a key up and interpolates it. A `count` value additionally selects
   * between the `_one`/`_other` variants, matching the suffix convention the
   * frontend's i18next catalogs already use — German and English share the
   * same "one vs. rest" plural rule, so no plural-rule library is needed.
   */
  t(key: ReportStringKey, values?: InterpolationValues): string;
  locale: ReportLocale;
}

function isReportLocale(locale: string): locale is ReportLocale {
  return locale in CATALOGS;
}

export function getReportStrings(locale: string): ReportStrings {
  const resolved: ReportLocale = isReportLocale(locale) ? locale : FALLBACK_LOCALE;
  const catalog = CATALOGS[resolved];

  return {
    locale: resolved,
    t(key, values) {
      const count = values?.count;
      const pluralKey =
        typeof count === 'number' ? `${key}_${count === 1 ? 'one' : 'other'}` : null;
      // A missing key surfaces as the key itself rather than an empty cell, so
      // a gap is visible in the rendered PDF instead of silently disappearing.
      const template = (pluralKey ? catalog[pluralKey] : undefined) ?? catalog[key] ?? key;
      return format(template, values);
    },
  };
}
