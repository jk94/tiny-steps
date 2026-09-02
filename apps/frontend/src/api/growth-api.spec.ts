import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import {
  createGrowthMeasurement,
  deleteGrowthMeasurement,
  fetchGrowthMeasurement,
  fetchGrowthReference,
  growthQueryKey,
  growthReferenceQueryKey,
  listGrowthMeasurements,
  updateGrowthMeasurement,
  type GrowthMeasurementSummary,
} from './growth-api';

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(httpClient.apiFetch);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const MEASUREMENT_ID = 'm1';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/growth`;

const summary: GrowthMeasurementSummary = {
  id: MEASUREMENT_ID,
  childId: CHILD_ID,
  userId: 'u1',
  measuredAt: '2025-04-01T09:00:00.000Z',
  ageInDaysAtMeasurement: 90,
  weightGrams: 6400,
  lengthMillimeters: 615,
  headCircumferenceMillimeters: 405,
  lengthMeasurementPosition: null,
  effectiveLengthMeasurementPosition: 'LYING',
  lengthOrHeightReferenceUsed: 'LENGTH',
  note: null,
  createdAt: '2025-04-01T09:00:00.000Z',
  updatedAt: '2025-04-01T09:00:00.000Z',
  percentiles: {
    weight: { status: 'COMPUTED', zScore: 0.1, percentile: 54 },
    length: { status: 'COMPUTED', zScore: -0.2, percentile: 42 },
    headCircumference: { status: 'UNAVAILABLE', reason: 'CHILD_SEX_NOT_SET' },
  },
};

describe('growth-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('is online-only: it never reaches into the offline layer (W-16)', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'growth-api.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/from '\.\.\/offline\//);
  });

  it('listGrowthMeasurements GETs the collection without a query string by default', async () => {
    mockedApiFetch.mockResolvedValueOnce([summary]);

    const result = await listGrowthMeasurements(HOUSEHOLD_ID, CHILD_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(BASE_PATH);
    expect(result).toEqual([summary]);
  });

  it('listGrowthMeasurements appends the from/to window when given', async () => {
    mockedApiFetch.mockResolvedValueOnce([]);

    await listGrowthMeasurements(HOUSEHOLD_ID, CHILD_ID, {
      from: '2025-01-01T00:00:00.000Z',
      to: '2025-06-01T00:00:00.000Z',
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      `${BASE_PATH}?from=2025-01-01T00%3A00%3A00.000Z&to=2025-06-01T00%3A00%3A00.000Z`,
    );
  });

  it('fetchGrowthMeasurement GETs one measurement by id', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await fetchGrowthMeasurement(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${MEASUREMENT_ID}`);
  });

  it('createGrowthMeasurement POSTs the input in base units', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await createGrowthMeasurement(HOUSEHOLD_ID, CHILD_ID, {
      measuredAt: '2025-04-01T09:00:00.000Z',
      weightGrams: 6400,
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(BASE_PATH, {
      method: 'POST',
      body: { measuredAt: '2025-04-01T09:00:00.000Z', weightGrams: 6400 },
    });
  });

  it('updateGrowthMeasurement PATCHes only the supplied fields, keeping explicit nulls', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await updateGrowthMeasurement(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID, {
      weightGrams: 6600,
      headCircumferenceMillimeters: null,
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${MEASUREMENT_ID}`, {
      method: 'PATCH',
      body: { weightGrams: 6600, headCircumferenceMillimeters: null },
    });
  });

  it('deleteGrowthMeasurement DELETEs and resolves on the empty 204 body', async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);

    await expect(
      deleteGrowthMeasurement(HOUSEHOLD_ID, CHILD_ID, MEASUREMENT_ID),
    ).resolves.toBeUndefined();
    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${MEASUREMENT_ID}`, {
      method: 'DELETE',
    });
  });

  it('fetchGrowthReference GETs the reference bands for one indicator', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      indicator: 'WEIGHT_FOR_AGE',
      sex: null,
      available: false,
      reason: 'CHILD_SEX_NOT_SET',
    });

    await fetchGrowthReference(HOUSEHOLD_ID, CHILD_ID, 'WEIGHT_FOR_AGE');

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/reference?indicator=WEIGHT_FOR_AGE`);
  });

  it('builds query keys following the households/children convention', () => {
    expect(growthQueryKey(HOUSEHOLD_ID, CHILD_ID)).toEqual([
      'households',
      HOUSEHOLD_ID,
      'children',
      CHILD_ID,
      'growth',
    ]);
    expect(growthReferenceQueryKey(HOUSEHOLD_ID, CHILD_ID, 'LENGTH_OR_HEIGHT_FOR_AGE')).toEqual([
      'households',
      HOUSEHOLD_ID,
      'children',
      CHILD_ID,
      'growth',
      'reference',
      'LENGTH_OR_HEIGHT_FOR_AGE',
    ]);
  });
});
