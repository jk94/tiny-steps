import { describe, expect, it } from 'vitest';
import { resolveDeepLinkPath } from './resolveDeepLinkPath';

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const BASE = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}`;

const ids = { householdId: HOUSEHOLD_ID, childId: CHILD_ID };

describe('resolveDeepLinkPath', () => {
  it('opens the recorded entry itself for a medical reminder (MED-11)', () => {
    expect(resolveDeepLinkPath({ ...ids, type: 'MEDICAL_REMINDER', healthRecordId: 'r1' })).toBe(
      `${BASE}/health/r1/edit`,
    );
  });

  it('falls back to the overview when the medical payload carries no record id', () => {
    // A payload from a server version that did not send the id yet: still a
    // useful destination, just less specific.
    expect(resolveDeepLinkPath({ ...ids, type: 'MEDICAL_REMINDER' })).toBe(`${BASE}/health`);
  });

  it('opens the feeding screen for a feeding reminder', () => {
    expect(resolveDeepLinkPath({ ...ids, type: 'FEEDING_REMINDER' })).toBe(`${BASE}/feeding`);
  });

  it('opens the child overview for a daily summary', () => {
    expect(resolveDeepLinkPath({ ...ids, type: 'DAILY_SUMMARY' })).toBe(BASE);
  });

  it('refuses to navigate without both ids — every route is household-scoped', () => {
    expect(resolveDeepLinkPath({ type: 'DAILY_SUMMARY', childId: CHILD_ID })).toBeNull();
    expect(resolveDeepLinkPath({ type: 'DAILY_SUMMARY', householdId: HOUSEHOLD_ID })).toBeNull();
    expect(resolveDeepLinkPath({})).toBeNull();
  });

  it('refuses an unknown type rather than guessing a destination', () => {
    expect(resolveDeepLinkPath({ ...ids, type: 'SOMETHING_NEW' })).toBeNull();
    expect(resolveDeepLinkPath({ ...ids })).toBeNull();
  });
});
