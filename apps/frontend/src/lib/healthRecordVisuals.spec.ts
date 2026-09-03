import { describe, expect, it } from 'vitest';
import de from '../i18n/locales/de.json';
import {
  HEALTH_RECORD_KINDS,
  healthRecordVisuals,
  OVERDUE_BADGE_VARIANT,
} from './healthRecordVisuals';

/** Resolves a dotted i18n key against a locale file. */
function lookup(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, segment) => (node as Record<string, unknown> | undefined)?.[segment],
      de,
    );
}

describe('healthRecordVisuals', () => {
  it('covers every kind the API can return', () => {
    expect(Object.keys(healthRecordVisuals).sort()).toEqual([...HEALTH_RECORD_KINDS].sort());
  });

  it.each(HEALTH_RECORD_KINDS)('resolves an icon and a real label key for %s', (kind) => {
    const visual = healthRecordVisuals[kind];
    expect(visual.Icon).toBeTypeOf('function');
    // A missing key would render the raw key string to the user.
    expect(lookup(visual.labelKey as string)).toBeTypeOf('string');
  });

  it('reuses existing Badge variants, so Phase 7.3 adds no colour token', () => {
    // If this ever needs a new variant, `design-tokens:build` has to run too —
    // see docs/design-system/reconciliation-process.md.
    for (const kind of HEALTH_RECORD_KINDS) {
      expect(healthRecordVisuals[kind].badgeVariant).toBe('default');
    }
    expect(OVERDUE_BADGE_VARIANT).toBe('warning');
  });
});
