import { describe, expect, it } from 'vitest';
import type { DiaperEventSummary } from '../api/diaper-api';
import { mergeServerAndPendingEvents } from './mergeServerAndPendingEvents';

function diaperAt(id: string, occurredAt: string): DiaperEventSummary {
  return {
    id,
    childId: 'c1',
    userId: 'u1',
    type: 'DIAPER',
    diaperType: 'PEE',
    occurredAt,
    note: null,
    createdAt: occurredAt,
  };
}

describe('mergeServerAndPendingEvents', () => {
  it('drops a pending event whose id already appears among the server events', () => {
    const server = [diaperAt('e1', '2026-01-01T10:00:00.000Z')];
    const pending = [diaperAt('e1', '2026-01-01T10:00:00.000Z')];

    const merged = mergeServerAndPendingEvents(server, pending, 'asc');

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('e1');
  });

  it('keeps a pending event that has no matching server row', () => {
    const server = [diaperAt('e1', '2026-01-01T10:00:00.000Z')];
    const pending = [diaperAt('local-2', '2026-01-01T11:00:00.000Z')];

    const merged = mergeServerAndPendingEvents(server, pending, 'asc');

    expect(merged.map((event) => event.id)).toEqual(['e1', 'local-2']);
  });

  it('sorts ascending by occurredAt', () => {
    const server = [
      diaperAt('late', '2026-01-01T12:00:00.000Z'),
      diaperAt('early', '2026-01-01T08:00:00.000Z'),
    ];
    const pending = [diaperAt('mid', '2026-01-01T10:00:00.000Z')];

    const merged = mergeServerAndPendingEvents(server, pending, 'asc');

    expect(merged.map((event) => event.id)).toEqual(['early', 'mid', 'late']);
  });

  it('sorts descending by occurredAt', () => {
    const server = [
      diaperAt('early', '2026-01-01T08:00:00.000Z'),
      diaperAt('late', '2026-01-01T12:00:00.000Z'),
    ];
    const pending = [diaperAt('mid', '2026-01-01T10:00:00.000Z')];

    const merged = mergeServerAndPendingEvents(server, pending, 'desc');

    expect(merged.map((event) => event.id)).toEqual(['late', 'mid', 'early']);
  });
});
