import { afterEach, describe, expect, it, vi } from 'vitest';
import * as httpClient from './http-client';
import {
  decideAlexaAuthorization,
  deleteAlexaLink,
  describeAlexaAuthorization,
  fetchAlexaLinks,
  readAlexaAuthorizationParams,
  updateAlexaLinkDefaultChild,
} from './alexa-api';

vi.mock('./http-client', async () => {
  const actual = await vi.importActual<typeof httpClient>('./http-client');
  return { ...actual, apiFetch: vi.fn() };
});

const mockedApiFetch = vi.mocked(httpClient.apiFetch);

const params = {
  client_id: 'tinysteps-alexa',
  redirect_uri: 'https://pitangui.amazon.com/api/skill/link/M1',
  response_type: 'code',
  state: 'abc',
};

describe('alexa-api', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('readAlexaAuthorizationParams', () => {
    it('keeps the known OAuth parameters and drops everything else', () => {
      const search = new URLSearchParams({ ...params, scope: 'tracking', utm_source: 'x' });
      expect(readAlexaAuthorizationParams(search)).toEqual({ ...params, scope: 'tracking' });
    });

    it.each(['client_id', 'redirect_uri', 'response_type'])(
      'returns null without %s',
      (missing) => {
        const search = new URLSearchParams(params);
        search.delete(missing);
        expect(readAlexaAuthorizationParams(search)).toBeNull();
      },
    );
  });

  it('describeAlexaAuthorization GETs the parameters as a query string', async () => {
    mockedApiFetch.mockResolvedValueOnce({ children: [] });

    await describeAlexaAuthorization(params);

    expect(mockedApiFetch).toHaveBeenCalledWith(
      `/alexa/oauth/authorize?${new URLSearchParams(params)}`,
    );
  });

  it('decideAlexaAuthorization POSTs approval with the default child', async () => {
    mockedApiFetch.mockResolvedValueOnce({ redirectTo: 'https://pitangui.amazon.com/x' });

    const result = await decideAlexaAuthorization(params, true, 'c1');

    expect(mockedApiFetch).toHaveBeenCalledWith('/alexa/oauth/authorize', {
      method: 'POST',
      body: { ...params, approve: true, default_child_id: 'c1' },
    });
    expect(result.redirectTo).toBe('https://pitangui.amazon.com/x');
  });

  it('decideAlexaAuthorization sends a denial without a default child', async () => {
    mockedApiFetch.mockResolvedValueOnce({ redirectTo: 'x' });

    await decideAlexaAuthorization(params, false, 'c1');

    expect(mockedApiFetch).toHaveBeenCalledWith('/alexa/oauth/authorize', {
      method: 'POST',
      body: { ...params, approve: false },
    });
  });

  it('manages links', async () => {
    mockedApiFetch.mockResolvedValue(undefined);

    await fetchAlexaLinks();
    await updateAlexaLinkDefaultChild('l1', null);
    await deleteAlexaLink('l1');

    expect(mockedApiFetch).toHaveBeenNthCalledWith(1, '/alexa/links');
    expect(mockedApiFetch).toHaveBeenNthCalledWith(2, '/alexa/links/l1', {
      method: 'PATCH',
      body: { defaultChildId: null },
    });
    expect(mockedApiFetch).toHaveBeenNthCalledWith(3, '/alexa/links/l1', { method: 'DELETE' });
  });
});
