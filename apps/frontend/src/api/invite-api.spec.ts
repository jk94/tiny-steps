import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import { acceptInvite, previewInvite } from './invite-api';

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(httpClient.apiFetch);

describe('invite-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('previewInvite GETs /invites/:token without skipAuthRetry', async () => {
    const preview = {
      status: 'valid' as const,
      householdName: 'Team Müller',
      expiresAt: '2026-01-08T00:00:00.000Z',
    };
    mockedApiFetch.mockResolvedValueOnce(preview);

    const result = await previewInvite('a-token');

    expect(mockedApiFetch).toHaveBeenCalledWith('/invites/a-token');
    expect(result).toEqual(preview);
  });

  it('acceptInvite POSTs to /invites/:token/accept', async () => {
    const accepted = { household: { id: '1', name: 'Team Müller' }, role: 'CO_PARENT' as const };
    mockedApiFetch.mockResolvedValueOnce(accepted);

    const result = await acceptInvite('a-token');

    expect(mockedApiFetch).toHaveBeenCalledWith('/invites/a-token/accept', { method: 'POST' });
    expect(result).toEqual(accepted);
  });
});
