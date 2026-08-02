import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import {
  createSleepEvent,
  deleteSleepEvent,
  fetchActiveSleepTimer,
  fetchSleepEvent,
  listSleepEvents,
  stopSleepTimer,
  updateSleepEvent,
} from './sleep-api';

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(httpClient.apiFetch);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const EVENT_ID = 'e1';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/sleep-events`;

const summary = {
  id: EVENT_ID,
  childId: CHILD_ID,
  userId: 'u1',
  type: 'SLEEP' as const,
  occurredAt: '2026-01-01T20:00:00.000Z',
  startedAt: '2026-01-01T20:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  createdAt: '2026-01-01T20:00:00.000Z',
};

describe('sleep-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('createSleepEvent POSTs the input to the sleep-events collection', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    const result = await createSleepEvent(HOUSEHOLD_ID, CHILD_ID, {});

    expect(mockedApiFetch).toHaveBeenCalledWith(BASE_PATH, {
      method: 'POST',
      body: {},
    });
    expect(result).toEqual(summary);
  });

  it('listSleepEvents GETs the sleep-events collection', async () => {
    mockedApiFetch.mockResolvedValueOnce([summary]);

    const result = await listSleepEvents(HOUSEHOLD_ID, CHILD_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(BASE_PATH);
    expect(result).toEqual([summary]);
  });

  it('fetchSleepEvent GETs the specific event', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await fetchSleepEvent(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${EVENT_ID}`);
  });

  it('fetchActiveSleepTimer GETs active-timer and can resolve null', async () => {
    mockedApiFetch.mockResolvedValueOnce(null);

    const result = await fetchActiveSleepTimer(HOUSEHOLD_ID, CHILD_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/active-timer`);
    expect(result).toBeNull();
  });

  it('updateSleepEvent PATCHes the given input', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await updateSleepEvent(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
      endedAt: '2026-01-02T06:00:00.000Z',
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${EVENT_ID}`, {
      method: 'PATCH',
      body: { endedAt: '2026-01-02T06:00:00.000Z' },
    });
  });

  it('stopSleepTimer POSTs to the stop sub-route with no body', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await stopSleepTimer(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${EVENT_ID}/stop`, {
      method: 'POST',
    });
  });

  it('deleteSleepEvent DELETEs the specific event', async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);

    await deleteSleepEvent(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${EVENT_ID}`, {
      method: 'DELETE',
    });
  });
});
