import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from './http-client';

function jsonResponse(status: number, body: unknown, ok = status >= 200 && status < 300): Response {
  return {
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

function setCookie(value: string | undefined) {
  document.cookie = value
    ? `csrf_token=${value}`
    : 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

function clearCookies() {
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

describe('apiFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    clearCookies();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCookies();
  });

  it('prefixes the path with /api and uses same-origin credentials on GET', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await apiFetch('/health');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/health');
    expect(init.credentials).toBe('same-origin');
  });

  it('attaches X-CSRF-Token on mutating requests when the cookie is present', async () => {
    setCookie('the-csrf-token');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await apiFetch('/children', { method: 'POST', body: { name: 'Alex' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get('X-CSRF-Token')).toBe('the-csrf-token');
  });

  it('omits X-CSRF-Token on a pre-session POST (no cookie set yet)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: { id: '1' } }));

    await apiFetch('/auth/login', {
      method: 'POST',
      body: { email: 'a@example.com', password: 'x' },
      skipAuthRetry: true,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.has('X-CSRF-Token')).toBe(false);
  });

  it('JSON-stringifies a plain object body and sets Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await apiFetch('/children', { method: 'POST', body: { name: 'Alex' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ name: 'Alex' }));
  });

  it('passes a FormData body through untouched without setting Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    const formData = new FormData();
    formData.append('photo', new Blob(['x']), 'photo.png');

    await apiFetch('/children/1/photo', { method: 'POST', body: formData });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(init.body).toBe(formData);
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('retries exactly once after a successful refresh on 401', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }, false)) // original
      .mockResolvedValueOnce(jsonResponse(200, { user: { id: '1' } })) // refresh
      .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' })); // retry

    const result = await apiFetch('/children');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(result).toEqual({ data: 'ok' });
  });

  it('propagates the original 401 when refresh also fails, with exactly 2 fetch calls', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'original unauthorized' }, false))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'refresh failed' }, false));

    await expect(apiFetch('/children')).rejects.toMatchObject({
      status: 401,
      body: { message: 'original unauthorized' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never attempts a refresh when skipAuthRetry is true', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'bad creds' }, false));

    await expect(apiFetch('/auth/login', { method: 'POST', skipAuthRetry: true })).rejects.toThrow(
      ApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares a single in-flight refresh call between two concurrent 401s', async () => {
    let resolveRefresh!: (value: Response) => void;
    const refreshResponsePromise = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });

    const callCounts = new Map<string, number>();
    fetchMock.mockImplementation((input: string) => {
      if (input === '/api/auth/refresh') {
        return refreshResponsePromise;
      }
      const count = (callCounts.get(input) ?? 0) + 1;
      callCounts.set(input, count);
      // First call for each URL 401s; the post-refresh retry succeeds.
      if (count === 1) {
        return Promise.resolve(jsonResponse(401, { message: 'unauthorized' }, false));
      }
      return Promise.resolve(jsonResponse(200, { retried: true }));
    });

    const first = apiFetch('/a');
    const second = apiFetch('/b');

    // Let both requests' 401 handlers reach the refresh call.
    await Promise.resolve();
    await Promise.resolve();
    resolveRefresh(jsonResponse(200, { user: { id: '1' } }));

    await Promise.all([first, second]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
  });

  it('throws ApiError with status/body for a non-401 non-ok response and does not refresh', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { statusCode: 404, message: 'Not Found', error: 'Not Found' }, false),
    );

    await expect(apiFetch('/children/missing')).rejects.toMatchObject({
      status: 404,
      body: { statusCode: 404, message: 'Not Found', error: 'Not Found' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
