import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import {
  buildChildFormData,
  childPhotoUrl,
  createChild,
  deleteChild,
  fetchChild,
  listChildren,
  updateChild,
} from './child-api';

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(httpClient.apiFetch);

describe('buildChildFormData', () => {
  it('appends name and birthDate when provided', () => {
    const formData = buildChildFormData({ name: 'Alex', birthDate: '2026-01-01' });

    expect(formData.get('name')).toBe('Alex');
    expect(formData.get('birthDate')).toBe('2026-01-01');
    expect(formData.has('photo')).toBe(false);
  });

  it('omits name/birthDate entirely when not provided (partial update)', () => {
    const formData = buildChildFormData({ name: 'Alex' });

    expect(formData.get('name')).toBe('Alex');
    expect(formData.has('birthDate')).toBe(false);
  });

  it('appends a photo File when provided', () => {
    const photo = new File(['x'], 'photo.png', { type: 'image/png' });

    const formData = buildChildFormData({ photo });

    expect(formData.get('photo')).toBe(photo);
  });

  it('omits the photo key entirely when photo is undefined (leaves existing photo untouched)', () => {
    const formData = buildChildFormData({ name: 'Alex' });

    expect(formData.has('photo')).toBe(false);
  });

  it('omits the photo key entirely when photo is explicitly null', () => {
    const formData = buildChildFormData({ name: 'Alex', photo: null });

    expect(formData.has('photo')).toBe(false);
  });
});

describe('child-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('createChild POSTs the given FormData to /households/:householdId/children', async () => {
    const child = {
      id: 'c1',
      householdId: 'h1',
      name: 'Alex',
      birthDate: '2026-01-01',
      hasPhoto: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    mockedApiFetch.mockResolvedValueOnce(child);
    const formData = buildChildFormData({ name: 'Alex', birthDate: '2026-01-01' });

    const result = await createChild('h1', formData);

    expect(mockedApiFetch).toHaveBeenCalledWith('/households/h1/children', {
      method: 'POST',
      body: formData,
    });
    expect(result).toEqual(child);
  });

  it('listChildren GETs /households/:householdId/children', async () => {
    mockedApiFetch.mockResolvedValueOnce([]);

    await listChildren('h1');

    expect(mockedApiFetch).toHaveBeenCalledWith('/households/h1/children');
  });

  it('fetchChild GETs /households/:householdId/children/:childId', async () => {
    mockedApiFetch.mockResolvedValueOnce({});

    await fetchChild('h1', 'c1');

    expect(mockedApiFetch).toHaveBeenCalledWith('/households/h1/children/c1');
  });

  it('updateChild PATCHes the given FormData to /households/:householdId/children/:childId', async () => {
    mockedApiFetch.mockResolvedValueOnce({});
    const formData = buildChildFormData({ name: 'Alexandra' });

    await updateChild('h1', 'c1', formData);

    expect(mockedApiFetch).toHaveBeenCalledWith('/households/h1/children/c1', {
      method: 'PATCH',
      body: formData,
    });
  });

  it('deleteChild DELETEs /households/:householdId/children/:childId', async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);

    await deleteChild('h1', 'c1');

    expect(mockedApiFetch).toHaveBeenCalledWith('/households/h1/children/c1', {
      method: 'DELETE',
    });
  });

  it('childPhotoUrl builds a plain path with a cache-busting query param', () => {
    expect(childPhotoUrl('h1', 'c1', 3)).toBe('/api/households/h1/children/c1/photo?v=3');
  });
});
