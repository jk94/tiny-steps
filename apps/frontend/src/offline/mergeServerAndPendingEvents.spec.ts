import { describe, expect, it } from 'vitest';
import type { DiaperEventSummary } from '../api/diaper-api';
import { mergeServerAndPendingEvents } from './mergeServerAndPendingEvents';
import type { LocalEventStatus, PendingEventRecord } from './pendingEvents.db';

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

function pending(
  id: string,
  occurredAt: string,
  status: LocalEventStatus = 'pending',
): { summary: DiaperEventSummary; status: LocalEventStatus } {
  return { summary: diaperAt(id, occurredAt), status };
}

describe('mergeServerAndPendingEvents', () => {
  it('drops a pending event whose id already appears among the server events', () => {
    const server = [diaperAt('e1', '2026-01-01T10:00:00.000Z')];
    const pendingEvents = [pending('e1', '2026-01-01T10:00:00.000Z')];

    const merged = mergeServerAndPendingEvents(server, pendingEvents, 'asc');

    expect(merged).toHaveLength(1);
    expect(merged[0].summary.id).toBe('e1');
    // The surviving row is the authoritative server one, so it carries no
    // local status even though a same-id pending copy existed.
    expect(merged[0].localStatus).toBeUndefined();
  });

  it('keeps a pending event that has no matching server row', () => {
    const server = [diaperAt('e1', '2026-01-01T10:00:00.000Z')];
    const pendingEvents = [pending('local-2', '2026-01-01T11:00:00.000Z')];

    const merged = mergeServerAndPendingEvents(server, pendingEvents, 'asc');

    expect(merged.map((event) => event.summary.id)).toEqual(['e1', 'local-2']);
  });

  it('leaves server rows without a local status and tags pending rows with theirs', () => {
    const server = [diaperAt('e1', '2026-01-01T10:00:00.000Z')];
    const pendingEvents = [
      pending('local-pending', '2026-01-01T11:00:00.000Z', 'pending'),
      pending('local-failed', '2026-01-01T12:00:00.000Z', 'failed'),
    ];

    const merged = mergeServerAndPendingEvents(server, pendingEvents, 'asc');

    expect(
      merged.map((event) => ({ id: event.summary.id, localStatus: event.localStatus })),
    ).toEqual([
      { id: 'e1', localStatus: undefined },
      { id: 'local-pending', localStatus: 'pending' },
      { id: 'local-failed', localStatus: 'failed' },
    ]);
  });

  it('sorts ascending by occurredAt', () => {
    const server = [
      diaperAt('late', '2026-01-01T12:00:00.000Z'),
      diaperAt('early', '2026-01-01T08:00:00.000Z'),
    ];
    const pendingEvents = [pending('mid', '2026-01-01T10:00:00.000Z')];

    const merged = mergeServerAndPendingEvents(server, pendingEvents, 'asc');

    expect(merged.map((event) => event.summary.id)).toEqual(['early', 'mid', 'late']);
  });

  it('sorts descending by occurredAt regardless of pending input order', () => {
    const server = [
      diaperAt('early', '2026-01-01T08:00:00.000Z'),
      diaperAt('late', '2026-01-01T12:00:00.000Z'),
    ];
    // Deliberately out of order to prove the merge — not the caller — sorts.
    const pendingEvents = [
      pending('mid-later', '2026-01-01T11:00:00.000Z'),
      pending('mid-earlier', '2026-01-01T10:00:00.000Z'),
    ];

    const merged = mergeServerAndPendingEvents(server, pendingEvents, 'desc');

    expect(merged.map((event) => event.summary.id)).toEqual([
      'late',
      'mid-later',
      'mid-earlier',
      'early',
    ]);
  });

  it('accepts pending records mapped straight off a PendingEventRecord', () => {
    // Documents the exact shape list components map into the merge, keeping the
    // record's `status` field wired through to `localStatus`.
    const record: Pick<PendingEventRecord, 'summary' | 'status'> = {
      summary: diaperAt('local-1', '2026-01-01T09:00:00.000Z'),
      status: 'failed',
    };

    const merged = mergeServerAndPendingEvents(
      [],
      [{ summary: record.summary as DiaperEventSummary, status: record.status }],
      'asc',
    );

    expect(merged[0].localStatus).toBe('failed');
  });
});
