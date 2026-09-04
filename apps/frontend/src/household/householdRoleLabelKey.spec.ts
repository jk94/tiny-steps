import { describe, expect, it } from 'vitest';
import { householdRoleLabelKey } from './householdRoleLabelKey';
import { ALL_ROLES } from '../lib/householdPermissions';
import i18n from '../i18n';

describe('householdRoleLabelKey', () => {
  it('resolves every role to its own English label', () => {
    const labels = ALL_ROLES.map((role) => i18n.t(householdRoleLabelKey(role)));

    expect(labels).toEqual(['Owner', 'Member', 'Carer', 'Viewer']);
  });

  it('never falls back to a raw key (every role has a translation)', () => {
    for (const role of ALL_ROLES) {
      const key = householdRoleLabelKey(role);
      expect(i18n.t(key)).not.toBe(key);
    }
  });
});
