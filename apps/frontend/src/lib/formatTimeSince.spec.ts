import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { TICK_INTERVAL_MS, formatTimeSince } from './formatTimeSince';

// The real i18next singleton (pinned to English by `src/test/setup.ts`), so
// these assertions cover the actual rendered copy including interpolation,
// not a stubbed `t()` that would only prove the branching.
const t = i18n.t.bind(i18n);

const NOW = new Date('2026-01-01T12:00:00.000Z').getTime();

describe('formatTimeSince', () => {
  it('renders whole minutes below one hour', () => {
    expect(formatTimeSince(t, '2026-01-01T11:45:00.000Z', NOW)).toBe('15 min ago');
  });

  it('renders "0 min ago" for an event that just happened', () => {
    expect(formatTimeSince(t, '2026-01-01T12:00:00.000Z', NOW)).toBe('0 min ago');
  });

  it('switches to hours at exactly 60 minutes', () => {
    expect(formatTimeSince(t, '2026-01-01T11:01:00.000Z', NOW)).toBe('59 min ago');
    expect(formatTimeSince(t, '2026-01-01T11:00:00.000Z', NOW)).toBe('1h ago');
  });

  it('rounds hours down rather than to the nearest hour', () => {
    expect(formatTimeSince(t, '2026-01-01T09:01:00.000Z', NOW)).toBe('2h ago');
  });

  it('clamps a future timestamp to zero instead of showing a negative figure', () => {
    expect(formatTimeSince(t, '2026-01-01T13:00:00.000Z', NOW)).toBe('0 min ago');
  });

  it('exposes a tick interval short enough to keep the minutes figure accurate', () => {
    expect(TICK_INTERVAL_MS).toBeLessThanOrEqual(60_000);
  });
});
