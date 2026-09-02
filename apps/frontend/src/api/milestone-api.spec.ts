import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import {
  createMilestone,
  deleteMilestone,
  deleteMilestonePhoto,
  fetchMilestone,
  listMilestones,
  milestonePhotoUrl,
  milestoneQueryKey,
  milestonesQueryKey,
  updateMilestone,
  uploadMilestonePhoto,
  type MilestoneSummary,
} from './milestone-api';

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(httpClient.apiFetch);

const HOUSEHOLD_ID = 'h1';
const CHILD_ID = 'c1';
const MILESTONE_ID = 'm1';
const BASE_PATH = `/households/${HOUSEHOLD_ID}/children/${CHILD_ID}/milestones`;

const summary: MilestoneSummary = {
  id: MILESTONE_ID,
  childId: CHILD_ID,
  userId: 'u1',
  templateKey: 'FIRST_STEPS',
  title: 'Erste Schritte',
  category: 'MOTOR',
  achievedAt: '2025-08-20T00:00:00.000Z',
  ageInDaysAtMilestone: 212,
  ageInMonthsAtMilestone: 7,
  note: null,
  createdAt: '2025-08-21T09:00:00.000Z',
  updatedAt: '2025-08-21T09:00:00.000Z',
  photos: [{ id: 'p1', sortIndex: 0, mimeType: 'image/png' }],
};

describe('milestone-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('is online-only: it never reaches into the offline layer (M-15)', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'milestone-api.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/from '\.\.\/offline\//);
  });

  it('listMilestones GETs the collection without a query string by default', async () => {
    mockedApiFetch.mockResolvedValueOnce([summary]);

    const result = await listMilestones(HOUSEHOLD_ID, CHILD_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(BASE_PATH);
    expect(result).toEqual([summary]);
  });

  it('listMilestones appends the from/to window when given', async () => {
    mockedApiFetch.mockResolvedValueOnce([]);

    await listMilestones(HOUSEHOLD_ID, CHILD_ID, {
      from: '2025-01-01T00:00:00.000Z',
      to: '2026-01-01T00:00:00.000Z',
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      `${BASE_PATH}?from=2025-01-01T00%3A00%3A00.000Z&to=2026-01-01T00%3A00%3A00.000Z`,
    );
  });

  it('fetchMilestone GETs one milestone by id', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await fetchMilestone(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID);

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${MILESTONE_ID}`);
  });

  it('createMilestone POSTs the template key together with the translated title', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await createMilestone(HOUSEHOLD_ID, CHILD_ID, {
      templateKey: 'FIRST_STEPS',
      title: 'Erste Schritte',
      achievedAt: '2025-08-20',
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(BASE_PATH, {
      method: 'POST',
      body: { templateKey: 'FIRST_STEPS', title: 'Erste Schritte', achievedAt: '2025-08-20' },
    });
  });

  it('updateMilestone PATCHes only the supplied fields, keeping explicit nulls', async () => {
    mockedApiFetch.mockResolvedValueOnce(summary);

    await updateMilestone(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, {
      achievedAt: '2025-08-21',
      note: null,
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${MILESTONE_ID}`, {
      method: 'PATCH',
      body: { achievedAt: '2025-08-21', note: null },
    });
  });

  it('deleteMilestone DELETEs and resolves on the empty 204 body', async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);

    await expect(deleteMilestone(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID)).resolves.toBeUndefined();
    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${MILESTONE_ID}`, {
      method: 'DELETE',
    });
  });

  it('uploadMilestonePhoto POSTs the file as multipart FormData', async () => {
    mockedApiFetch.mockResolvedValueOnce({ id: 'p2', sortIndex: 1, mimeType: 'image/png' });
    const file = new File(['bytes'], 'photo.png', { type: 'image/png' });

    await uploadMilestonePhoto(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, file);

    const [path, options] = mockedApiFetch.mock.calls[0];
    expect(path).toBe(`${BASE_PATH}/${MILESTONE_ID}/photos`);
    expect(options?.method).toBe('POST');
    // FormData, not a JSON object — `apiFetch` passes it through untouched so
    // the browser sets the multipart boundary itself.
    expect(options?.body).toBeInstanceOf(FormData);
    expect((options?.body as FormData).get('photo')).toBe(file);
  });

  it('deleteMilestonePhoto DELETEs a single photo', async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);

    await deleteMilestonePhoto(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, 'p1');

    expect(mockedApiFetch).toHaveBeenCalledWith(`${BASE_PATH}/${MILESTONE_ID}/photos/p1`, {
      method: 'DELETE',
    });
  });

  it('builds an <img src>-able photo URL under the /api prefix', () => {
    expect(milestonePhotoUrl(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID, 'p1')).toBe(
      `/api${BASE_PATH}/${MILESTONE_ID}/photos/p1`,
    );
  });

  it('builds query keys following the households/children convention', () => {
    expect(milestonesQueryKey(HOUSEHOLD_ID, CHILD_ID)).toEqual([
      'households',
      HOUSEHOLD_ID,
      'children',
      CHILD_ID,
      'milestones',
    ]);
  });

  it('nests the single-milestone key under the list key so one invalidation covers both', () => {
    const listKey = milestonesQueryKey(HOUSEHOLD_ID, CHILD_ID);
    const singleKey = milestoneQueryKey(HOUSEHOLD_ID, CHILD_ID, MILESTONE_ID);

    expect(singleKey.slice(0, listKey.length)).toEqual([...listKey]);
  });
});
