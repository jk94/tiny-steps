import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import { fetchDailyEvents, fetchEventStats } from './event-api';

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(httpClient.apiFetch);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const FROM = '2026-01-01T00:00:00.000Z';
const TO = '2026-01-02T00:00:00.000Z';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/events`;

describe('event-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('fetchDailyEvents GETs the daily sub-route with from/to as query params', async () => {
    mockedApiFetch.mockResolvedValueOnce([]);

    const result = await fetchDailyEvents(HOUSEHOLD_ID, CHILD_ID, FROM, TO);

    expect(mockedApiFetch).toHaveBeenCalledWith(
      `${BASE_PATH}/daily?from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`,
    );
    expect(result).toEqual([]);
  });

  it('fetchEventStats GETs the stats sub-route with from/to as query params', async () => {
    const stats = {
      sleepHoursToday: 2.5,
      feedingCountToday: 4,
      lastEventAt: { FEEDING: FROM, SLEEP: null, DIAPER: null },
    };
    mockedApiFetch.mockResolvedValueOnce(stats);

    const result = await fetchEventStats(HOUSEHOLD_ID, CHILD_ID, FROM, TO);

    expect(mockedApiFetch).toHaveBeenCalledWith(
      `${BASE_PATH}/stats?from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`,
    );
    expect(result).toEqual(stats);
  });
});
