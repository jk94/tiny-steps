import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import { registerPushToken } from './push-api';

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(httpClient.apiFetch);

describe('push-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('POSTs the token and platform to /push/subscriptions', async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);

    await registerPushToken('fcm-token', 'ANDROID');

    expect(mockedApiFetch).toHaveBeenCalledWith('/push/subscriptions', {
      method: 'POST',
      body: { token: 'fcm-token', platform: 'ANDROID' },
    });
  });

  it('forwards the iOS platform value', async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);

    await registerPushToken('ios-token', 'IOS');

    expect(mockedApiFetch).toHaveBeenCalledWith('/push/subscriptions', {
      method: 'POST',
      body: { token: 'ios-token', platform: 'IOS' },
    });
  });
});
