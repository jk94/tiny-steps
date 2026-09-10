import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import {
  createHealthRecord,
  deleteHealthRecord,
  fetchHealthRecord,
  healthRecordQueryKey,
  healthRecordsQueryKey,
  listHealthRecords,
  updateHealthRecord,
  type HealthRecordSummary,
} from './health-record-api';

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(httpClient.apiFetch);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const RECORD_ID = 'r1';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/health-records`;

const summary: HealthRecordSummary = {
  id: RECORD_ID,
  childId: CHILD_ID,
  userId: 'u1',
  kind: 'MEDICATION',
  name: 'Paracetamol',
  administeredAt: '2025-08-20T14:30:00.000Z',
  dueAt: null,
  doseAmount: 5,
  doseUnit: 'ml',
  vaccineBatch: null,
  note: null,
  reminderEnabled: false,
  createdAt: '2025-08-21T09:00:00.000Z',
  updatedAt: '2025-08-21T09:00:00.000Z',
};

describe('health-record-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('is online-only: it never reaches into the offline layer (MED-15)', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'health-record-api.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/from '\.\.\/offline\//);
  });

  it('GETs the collection without a query string by default', async () => {
    mockedApiFetch.mockResolvedValueOnce([summary]);

    const result = await listHealthRecords(HOUSEHOLD_ID, CHILD_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(BASE_PATH);
    expect(result).toEqual([summary]);
  });

  it('appends only the filters that are actually set', async () => {
    mockedApiFetch.mockResolvedValue([]);

    await listHealthRecords(HOUSEHOLD_ID, CHILD_ID, { kind: 'VACCINATION' });
    expect(mockedApiFetch).toHaveBeenLastCalledWith(`${BASE_PATH}?kind=VACCINATION`);

    await listHealthRecords(HOUSEHOLD_ID, CHILD_ID, { status: 'planned' });
    expect(mockedApiFetch).toHaveBeenLastCalledWith(`${BASE_PATH}?status=planned`);

    await listHealthRecords(HOUSEHOLD_ID, CHILD_ID, { kind: 'MEDICATION', status: 'done' });
    expect(mockedApiFetch).toHaveBeenLastCalledWith(`${BASE_PATH}?kind=MEDICATION&status=done`);
  });

  it('GETs a single record by id', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await fetchHealthRecord(HOUSEHOLD_ID, CHILD_ID, RECORD_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${RECORD_ID}`);
  });

  it('POSTs a create body', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await createHealthRecord(HOUSEHOLD_ID, CHILD_ID, {
      kind: 'MEDICATION',
      name: 'Paracetamol',
      administeredAt: '2025-08-20T14:30:00.000Z',
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(BASE_PATH, {
      method: 'POST',
      body: {
        kind: 'MEDICATION',
        name: 'Paracetamol',
        administeredAt: '2025-08-20T14:30:00.000Z',
      },
    });
  });

  it('PATCHes a partial body, forwarding an explicit null as "clear it"', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await updateHealthRecord(HOUSEHOLD_ID, CHILD_ID, RECORD_ID, { note: null });

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${RECORD_ID}`, {
      method: 'PATCH',
      body: { note: null },
    });
  });

  it('DELETEs a record by id', async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);

    await deleteHealthRecord(HOUSEHOLD_ID, CHILD_ID, RECORD_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${RECORD_ID}`, {
      method: 'DELETE',
    });
  });

  it('nests the single-record key under the list key, so one invalidation reaches both', () => {
    expect(healthRecordQueryKey(HOUSEHOLD_ID, CHILD_ID, RECORD_ID).slice(0, 5)).toEqual([
      ...healthRecordsQueryKey(HOUSEHOLD_ID, CHILD_ID),
    ]);
  });
});
