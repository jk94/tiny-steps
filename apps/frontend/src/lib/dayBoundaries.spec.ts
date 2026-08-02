import { describe, expect, it } from 'vitest';
import { getLocalDayBoundaries } from './dayBoundaries';

describe('getLocalDayBoundaries', () => {
  it('returns from/to exactly 24h apart', () => {
    const { from, to } = getLocalDayBoundaries(new Date('2026-06-15T14:30:00'));

    const diffMs = new Date(to).getTime() - new Date(from).getTime();

    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });

  it('lands on local midnight boundaries, independent of the environment timezone', () => {
    const input = new Date(2026, 5, 15, 14, 30, 0, 0); // local time, deliberately not UTC-constructed
    const { from, to } = getLocalDayBoundaries(input);

    const fromLocal = new Date(from);
    const toLocal = new Date(to);

    expect(fromLocal.getFullYear()).toBe(2026);
    expect(fromLocal.getMonth()).toBe(5);
    expect(fromLocal.getDate()).toBe(15);
    expect(fromLocal.getHours()).toBe(0);
    expect(fromLocal.getMinutes()).toBe(0);
    expect(fromLocal.getSeconds()).toBe(0);

    expect(toLocal.getFullYear()).toBe(2026);
    expect(toLocal.getMonth()).toBe(5);
    expect(toLocal.getDate()).toBe(16);
    expect(toLocal.getHours()).toBe(0);
  });

  it('derives dateKey as YYYY-MM-DD from the given date’s local fields', () => {
    const { dateKey } = getLocalDayBoundaries(new Date(2026, 0, 5, 23, 59, 0, 0));

    expect(dateKey).toBe('2026-01-05');
  });

  it('correctly rolls over month/year boundaries (Dec 31 -> Jan 1)', () => {
    const { to, dateKey } = getLocalDayBoundaries(new Date(2025, 11, 31, 10, 0, 0, 0));

    expect(dateKey).toBe('2025-12-31');
    const toLocal = new Date(to);
    expect(toLocal.getFullYear()).toBe(2026);
    expect(toLocal.getMonth()).toBe(0);
    expect(toLocal.getDate()).toBe(1);
  });

  it('defaults to the current date when no argument is given', () => {
    const { dateKey } = getLocalDayBoundaries();
    const now = new Date();
    const expectedKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    expect(dateKey).toBe(expectedKey);
  });
});
