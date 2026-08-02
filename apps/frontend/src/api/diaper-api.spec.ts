import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import {
  createDiaperEvent,
  deleteDiaperEvent,
  fetchDiaperEvent,
  listDiaperEvents,
  updateDiaperEvent,
} from './diaper-api';

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(httpClient.apiFetch);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const EVENT_ID = 'e1';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/diaper-events`;

const summary = {
  id: EVENT_ID,
  childId: CHILD_ID,
  userId: 'u1',
  type: 'DIAPER' as const,
  diaperType: 'PEE' as const,
  occurredAt: '2026-01-01T10:00:00.000Z',
  note: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

describe('diaper-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('createDiaperEvent POSTs the input to the diaper-events collection', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    const result = await createDiaperEvent(HOUSEHOLD_ID, CHILD_ID, { diaperType: 'PEE' });

    expect(mockedApiFetch).toHaveBeenCalledWith(BASE_PATH, {
      method: 'POST',
      body: { diaperType: 'PEE' },
    });
    expect(result).toEqual(summary);
  });

  it('listDiaperEvents GETs the diaper-events collection', async () => {
    mockedApiFetch.mockResolvedValueOnce([summary]);

    const result = await listDiaperEvents(HOUSEHOLD_ID, CHILD_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(BASE_PATH);
    expect(result).toEqual([summary]);
  });

  it('fetchDiaperEvent GETs the specific event', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await fetchDiaperEvent(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${EVENT_ID}`);
  });

  it('updateDiaperEvent PATCHes the given input, including diaperType', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await updateDiaperEvent(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, {
      diaperType: 'BOTH',
      note: 'updated',
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${EVENT_ID}`, {
      method: 'PATCH',
      body: { diaperType: 'BOTH', note: 'updated' },
    });
  });

  it('deleteDiaperEvent DELETEs the specific event', async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);

    await deleteDiaperEvent(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${EVENT_ID}`, {
      method: 'DELETE',
    });
  });
});
