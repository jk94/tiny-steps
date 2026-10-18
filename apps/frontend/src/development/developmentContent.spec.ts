import { describe, expect, it } from 'vitest';
import { developmentContent as de } from './content/de';
import { developmentContent as en } from './content/en';
import type { DevelopmentContent } from './content/types';
import { developmentEntryFor, toDevelopmentLocale } from './developmentContent';
import { DEVELOPMENT_STAGE_MILESTONES } from './developmentMilestones';
import { DEVELOPMENT_SOURCES } from './developmentSources';
import {
  ALL_DEVELOPMENT_STAGES,
  FIRST_MONTH_STAGE,
  FIRST_YEAR_WEEKS,
  LAST_MONTH_STAGE,
  developmentStageKey,
  parseDevelopmentStageKey,
} from './developmentStage';
import { MILESTONE_TEMPLATES } from '../lib/milestoneCatalog';

// Generous upper bounds that keep the dashboard card a glanceable teaser
// rather than a wall of text on a phone screen.
const MAX_TITLE_LENGTH = 60;
const MAX_TEASER_LENGTH = 180;

const LOCALES: ReadonlyArray<[string, DevelopmentContent]> = [
  ['de', de],
  ['en', en],
];

describe.each(LOCALES)('development content (%s)', (_locale, content) => {
  it('has exactly one entry per week of the first year and per month up to 36', () => {
    expect(content.weeks).toHaveLength(FIRST_YEAR_WEEKS);
    expect(content.months).toHaveLength(LAST_MONTH_STAGE - FIRST_MONTH_STAGE + 1);
  });

  it('resolves an entry for every stage of the calendar', () => {
    for (const stage of ALL_DEVELOPMENT_STAGES) {
      expect(developmentEntryFor(content, stage), developmentStageKey(stage)).toBeDefined();
    }
  });

  it('fills every field of every entry', () => {
    for (const stage of ALL_DEVELOPMENT_STAGES) {
      const entry = developmentEntryFor(content, stage)!;
      const label = developmentStageKey(stage);

      expect(entry.title.trim(), label).not.toBe('');
      expect(entry.title.length, label).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
      expect(entry.teaser.trim(), label).not.toBe('');
      expect(entry.teaser.length, label).toBeLessThanOrEqual(MAX_TEASER_LENGTH);
      expect(entry.body.length, label).toBeGreaterThan(0);
      expect(entry.tips.length, label).toBeGreaterThanOrEqual(2);
      expect(entry.sources.length, label).toBeGreaterThan(0);
      for (const text of [entry.title, entry.teaser, ...entry.body, ...entry.tips]) {
        expect(text.trim(), label).not.toBe('');
      }
    }
  });

  it('gives every stage a distinct title', () => {
    const titles = [...content.weeks, ...content.months].map((entry) => entry.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('cites only known sources, each at most once per entry', () => {
    for (const entry of [...content.weeks, ...content.months]) {
      for (const sourceId of entry.sources) {
        expect(DEVELOPMENT_SOURCES).toHaveProperty(sourceId);
      }
      expect(new Set(entry.sources).size).toBe(entry.sources.length);
    }
  });
});

describe('development sources', () => {
  it('link only to distinct https URLs', () => {
    const urls = Object.values(DEVELOPMENT_SOURCES).map((source) => source.url);
    for (const url of urls) {
      expect(new URL(url).protocol).toBe('https:');
    }
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('are all cited somewhere, so the registry carries no dead entries', () => {
    const cited = new Set(
      [...de.weeks, ...de.months, ...en.weeks, ...en.months].flatMap((entry) => entry.sources),
    );
    expect([...cited].sort()).toEqual(Object.keys(DEVELOPMENT_SOURCES).sort());
  });
});

describe('DEVELOPMENT_STAGE_MILESTONES', () => {
  it('keys real stages and points at real catalog templates', () => {
    const templateKeys = new Set(MILESTONE_TEMPLATES.map((template) => template.key));
    for (const [stageKey, milestoneKeys] of Object.entries(DEVELOPMENT_STAGE_MILESTONES)) {
      expect(parseDevelopmentStageKey(stageKey), stageKey).not.toBeNull();
      for (const key of milestoneKeys) {
        expect(templateKeys.has(key), key).toBe(true);
      }
    }
  });

  it('links each catalog template from at most one stage', () => {
    const linked = Object.values(DEVELOPMENT_STAGE_MILESTONES).flat();
    expect(new Set(linked).size).toBe(linked.length);
  });
});

describe('toDevelopmentLocale', () => {
  it.each([
    ['en', 'en'],
    ['en-GB', 'en'],
    ['de', 'de'],
    ['de-AT', 'de'],
    ['fr', 'de'],
    [undefined, 'de'],
  ])('maps %j to %j', (language, expected) => {
    expect(toDevelopmentLocale(language)).toBe(expected);
  });
});
