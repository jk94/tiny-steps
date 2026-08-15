import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import { downloadExport } from './export-api';

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetchBlob: vi.fn() };
});

const mockedApiFetchBlob = vi.mocked(httpClient.apiFetchBlob);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const FROM = '2026-01-01T00:00:00.000Z';
const TO = '2026-01-02T00:00:00.000Z';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/export`;

function stubBlob() {
  mockedApiFetchBlob.mockResolvedValueOnce({
    blob: new Blob(['x']),
    filename: 'export.json',
  });
}

describe('export-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('GETs the json sub-route with no query when no range is given', async () => {
    stubBlob();

    await downloadExport(HOUSEHOLD_ID, CHILD_ID, 'json');

    expect(mockedApiFetchBlob).toHaveBeenCalledWith(`${BASE_PATH}/json`);
  });

  it('GETs the csv sub-route with no query when no range is given', async () => {
    stubBlob();

    await downloadExport(HOUSEHOLD_ID, CHILD_ID, 'csv');

    expect(mockedApiFetchBlob).toHaveBeenCalledWith(`${BASE_PATH}/csv`);
  });

  it('appends only from when to is omitted', async () => {
    stubBlob();

    await downloadExport(HOUSEHOLD_ID, CHILD_ID, 'json', FROM);

    expect(mockedApiFetchBlob).toHaveBeenCalledWith(
      `${BASE_PATH}/json?from=${encodeURIComponent(FROM)}`,
    );
  });

  it('appends only to when from is omitted', async () => {
    stubBlob();

    await downloadExport(HOUSEHOLD_ID, CHILD_ID, 'csv', undefined, TO);

    expect(mockedApiFetchBlob).toHaveBeenCalledWith(
      `${BASE_PATH}/csv?to=${encodeURIComponent(TO)}`,
    );
  });

  it('appends both from and to when a full range is given', async () => {
    stubBlob();

    await downloadExport(HOUSEHOLD_ID, CHILD_ID, 'json', FROM, TO);

    expect(mockedApiFetchBlob).toHaveBeenCalledWith(
      `${BASE_PATH}/json?from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`,
    );
  });

  it('returns the blob response from apiFetchBlob', async () => {
    const response = { blob: new Blob(['data']), filename: 'export-c1.csv' };
    mockedApiFetchBlob.mockResolvedValueOnce(response);

    await expect(downloadExport(HOUSEHOLD_ID, CHILD_ID, 'csv')).resolves.toBe(response);
  });
});
