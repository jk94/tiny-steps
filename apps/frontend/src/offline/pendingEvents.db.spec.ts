import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { FeedingEventSummary } from '../api/feeding-api';
import type { PendingEventRecord } from './pendingEvents.db';

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';

// The db module memoizes its open-connection promise, so a fresh IDBFactory
// alone wouldn't isolate tests (the module keeps the old connection). Reset the
// module registry too and re-import, so each test gets a brand-new module +
// empty database.
let db: typeof import('./pendingEvents.db');

beforeEach(async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.resetModules();
  db = await import('./pendingEvents.db');
});

function feedingSummary(id: string): FeedingEventSummary {
  return {
    id,
    childId: CHILD_ID,
    userId: 'u1',
    type: 'FEEDING',
    feedingType: 'BREAST',
    occurredAt: '2026-01-01T10:00:00.000Z',
    startedAt: '2026-01-01T10:00:00.000Z',
    endedAt: null,
    durationSeconds: null,
    side: 'LEFT',
    amountMl: null,
    note: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  };
}

function pendingRecord(overrides: Partial<PendingEventRecord> = {}): PendingEventRecord {
  const localId = overrides.localId ?? 'local-1';
  return {
    localId,
    householdId: HOUSEHOLD_ID,
    childId: CHILD_ID,
    eventType: 'FEEDING',
    status: 'pending',
    savedAt: '2026-01-01T10:00:00.000Z',
    summary: feedingSummary(localId),
    ...overrides,
  };
}

describe('pendingEvents.db', () => {
  it('round-trips a record through put, list, and delete', async () => {
    await db.putPendingEvent(pendingRecord({ localId: 'local-1' }));

    const afterPut = await db.listPendingEvents(HOUSEHOLD_ID, CHILD_ID);
    expect(afterPut).toHaveLength(1);
    expect(afterPut[0].localId).toBe('local-1');
    expect(afterPut[0].status).toBe('pending');

    await db.deletePendingEvent('local-1');

    expect(await db.listPendingEvents(HOUSEHOLD_ID, CHILD_ID)).toHaveLength(0);
  });

  it('markPendingEventFailed flips the status in place without deleting', async () => {
    await db.putPendingEvent(pendingRecord({ localId: 'local-1' }));

    await db.markPendingEventFailed('local-1');

    const records = await db.listPendingEvents(HOUSEHOLD_ID, CHILD_ID);
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('failed');
  });

  it('markPendingEventFailed is a no-op for an already-deleted record', async () => {
    await expect(db.markPendingEventFailed('local-missing')).resolves.toBeUndefined();
    expect(await db.listPendingEvents(HOUSEHOLD_ID, CHILD_ID)).toHaveLength(0);
  });

  it('scopes reads to the requested household+child via the byChild index', async () => {
    await db.putPendingEvent(pendingRecord({ localId: 'local-mine' }));
    await db.putPendingEvent(
      pendingRecord({ localId: 'local-other-child', childId: 'other-child' }),
    );
    await db.putPendingEvent(
      pendingRecord({ localId: 'local-other-household', householdId: 'other-household' }),
    );

    const records = await db.listPendingEvents(HOUSEHOLD_ID, CHILD_ID);

    expect(records.map((record) => record.localId)).toEqual(['local-mine']);
  });

  it('optionally narrows the list to a single event type', async () => {
    await db.putPendingEvent(pendingRecord({ localId: 'local-feeding', eventType: 'FEEDING' }));
    await db.putPendingEvent(pendingRecord({ localId: 'local-sleep', eventType: 'SLEEP' }));

    const feedingOnly = await db.listPendingEvents(HOUSEHOLD_ID, CHILD_ID, 'FEEDING');

    expect(feedingOnly.map((record) => record.localId)).toEqual(['local-feeding']);
  });

  it('listAllPendingEvents spans every household and child in the store', async () => {
    await db.putPendingEvent(pendingRecord({ localId: 'local-mine' }));
    await db.putPendingEvent(
      pendingRecord({ localId: 'local-other-child', childId: 'other-child' }),
    );
    await db.putPendingEvent(
      pendingRecord({ localId: 'local-other-household', householdId: 'other-household' }),
    );

    const all = await db.listAllPendingEvents();

    expect(all.map((record) => record.localId).sort()).toEqual([
      'local-mine',
      'local-other-child',
      'local-other-household',
    ]);
  });

  it('markPendingEventRetryScheduled bumps retryCount and nextRetryAt in place, keeping the record failed', async () => {
    await db.putPendingEvent(pendingRecord({ localId: 'local-1' }));

    await db.markPendingEventRetryScheduled('local-1', 2, '2026-01-01T10:05:00.000Z');

    const [record] = await db.listPendingEvents(HOUSEHOLD_ID, CHILD_ID);
    expect(record.status).toBe('failed');
    expect(record.retryCount).toBe(2);
    expect(record.nextRetryAt).toBe('2026-01-01T10:05:00.000Z');
  });

  it('markPendingEventRetryScheduled leaves nextRetryAt undefined when omitted (abandoned record)', async () => {
    await db.putPendingEvent(pendingRecord({ localId: 'local-1' }));

    await db.markPendingEventRetryScheduled('local-1', 6);

    const [record] = await db.listPendingEvents(HOUSEHOLD_ID, CHILD_ID);
    expect(record.retryCount).toBe(6);
    expect(record.nextRetryAt).toBeUndefined();
  });

  it('markPendingEventRetryScheduled is a no-op for an already-deleted record', async () => {
    await expect(db.markPendingEventRetryScheduled('local-missing', 1)).resolves.toBeUndefined();
    expect(await db.listPendingEvents(HOUSEHOLD_ID, CHILD_ID)).toHaveLength(0);
  });

  it('returns every matching record without imposing an order', async () => {
    // Ordering is deliberately not this function's concern — the caller re-sorts
    // via `mergeServerAndPendingEvents`. So we only assert the full set is
    // returned, order-agnostically, rather than a particular sequence.
    await db.putPendingEvent(
      pendingRecord({ localId: 'local-older', savedAt: '2026-01-01T09:00:00.000Z' }),
    );
    await db.putPendingEvent(
      pendingRecord({ localId: 'local-newer', savedAt: '2026-01-01T11:00:00.000Z' }),
    );

    const records = await db.listPendingEvents(HOUSEHOLD_ID, CHILD_ID);

    expect(records.map((record) => record.localId).sort()).toEqual(['local-newer', 'local-older']);
  });
});
