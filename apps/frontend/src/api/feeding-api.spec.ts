import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import {
  createFeedingEvent,
  deleteFeedingEvent,
  fetchActiveFeedingTimer,
  fetchFeedingEvent,
  listFeedingEvents,
  stopFeedingTimer,
  updateFeedingEvent,
} from './feeding-api';

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(httpClient.apiFetch);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const EVENT_ID = 'e1';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/feeding-events`;

const summary = {
  id: EVENT_ID,
  childId: CHILD_ID,
  userId: 'u1',
  type: 'FEEDING' as const,
  feedingType: 'BREAST' as const,
  occurredAt: '2026-01-01T10:00:00.000Z',
  startedAt: '2026-01-01T10:00:00.000Z',
  endedAt: null,
  durationSeconds: null,
  side: 'LEFT' as const,
  amountMl: null,
  note: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

describe('feeding-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it('createFeedingEvent POSTs the input to the feeding-events collection', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    const result = await createFeedingEvent(HOUSEHOLD_ID, CHILD_ID, {
      feedingType: 'BREAST',
      side: 'LEFT',
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(BASE_PATH, {
      method: 'POST',
      body: { feedingType: 'BREAST', side: 'LEFT' },
    });
    expect(result).toEqual(summary);
  });

  it('listFeedingEvents GETs the feeding-events collection', async () => {
    mockedApiFetch.mockResolvedValueOnce([summary]);

    const result = await listFeedingEvents(HOUSEHOLD_ID, CHILD_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(BASE_PATH);
    expect(result).toEqual([summary]);
  });

  it('fetchFeedingEvent GETs the specific event', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await fetchFeedingEvent(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${EVENT_ID}`);
  });

  it('fetchActiveFeedingTimer GETs active-timer and can resolve null', async () => {
    mockedApiFetch.mockResolvedValueOnce(null);

    const result = await fetchActiveFeedingTimer(HOUSEHOLD_ID, CHILD_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/active-timer`);
    expect(result).toBeNull();
  });

  it('fetchActiveFeedingTimer resolves null (not undefined) for the empty body sent when no timer runs', async () => {
    // The backend's `null` arrives as an empty body, which the real `apiFetch`
    // maps to `undefined` — run it against a stubbed `fetch` so that mapping is
    // exercised rather than assumed. React Query rejects `undefined` as data.
    const actual = await vi.importActual<typeof httpClient>('./http-client');
    mockedApiFetch.mockImplementationOnce(actual.apiFetch);
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchActiveFeedingTimer(HOUSEHOLD_ID, CHILD_ID);

    expect(fetchMock).toHaveBeenCalledWith(`/api${BASE_PATH}/active-timer`, expect.anything());
    expect(result).toBeNull();
  });

  it('fetchActiveFeedingTimer passes a running timer through unchanged', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    const result = await fetchActiveFeedingTimer(HOUSEHOLD_ID, CHILD_ID);

    expect(result).toEqual(summary);
  });

  it('updateFeedingEvent PATCHes the given input', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await updateFeedingEvent(HOUSEHOLD_ID, CHILD_ID, EVENT_ID, { note: 'updated' });

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${EVENT_ID}`, {
      method: 'PATCH',
      body: { note: 'updated' },
    });
  });

  it('stopFeedingTimer POSTs to the stop sub-route with no body', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await stopFeedingTimer(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${EVENT_ID}/stop`, {
      method: 'POST',
    });
  });

  it('deleteFeedingEvent DELETEs the specific event', async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);

    await deleteFeedingEvent(HOUSEHOLD_ID, CHILD_ID, EVENT_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${EVENT_ID}`, {
      method: 'DELETE',
    });
  });
});
