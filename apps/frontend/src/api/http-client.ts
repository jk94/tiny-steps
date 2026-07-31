const API_PREFIX = '/api';
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Thrown for any non-ok response not resolved by the 401-refresh-retry flow below. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body' | 'credentials'> {
  body?: BodyInit | Record<string, unknown> | null;
  /**
   * When true, a 401 response is propagated as-is instead of triggering the
   * refresh-then-retry flow. Used for pre-session calls (login/register,
   * where a 401 means "wrong credentials", not "expired token") and by
   * `refreshSession()` itself (a failed refresh must never trigger another
   * refresh attempt).
   */
  skipAuthRetry?: boolean;
}

/** Tiny `document.cookie` parser — no need for a library for one lookup. */
export function readCookie(name: string): string | undefined {
  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.split('=');
    if (cookieName === name) {
      return rest.join('=');
    }
  }
  return undefined;
}

function isPlainObjectBody(body: ApiFetchOptions['body']): body is Record<string, unknown> {
  if (body === null || body === undefined || typeof body !== 'object') {
    return false;
  }
  // Anything that isn't a plain object literal (FormData, Blob, URLSearchParams,
  // ReadableStream, ArrayBuffer, ...) is forwarded untouched — most importantly
  // FormData, needed for the future multipart child-photo upload endpoint.
  return body.constructor === Object;
}

function buildRequestInit(options: ApiFetchOptions): RequestInit {
  const headers = new Headers(options.headers);
  let body: BodyInit | null | undefined = options.body as BodyInit | null | undefined;

  if (isPlainObjectBody(options.body)) {
    body = JSON.stringify(options.body);
    headers.set('Content-Type', 'application/json');
  }

  const method = (options.method ?? 'GET').toUpperCase();
  if (MUTATING_METHODS.has(method)) {
    // Unconditionally attempt to attach the CSRF header — harmless on routes
    // that don't require it (register/login, pre-session), correct on the
    // ones that do (refresh/logout, and future authenticated mutations).
    const csrfToken = readCookie(CSRF_COOKIE_NAME);
    if (csrfToken !== undefined) {
      headers.set(CSRF_HEADER_NAME, csrfToken);
    }
  }

  return {
    ...options,
    method,
    headers,
    body,
    // Same-origin only — the dev proxy (see vite.config.ts) makes this work
    // identically in dev and in the single-container production topology.
    credentials: 'same-origin',
  };
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Single-flight guard: concurrent 401s share one in-flight refresh call
// instead of each triggering their own `POST /api/auth/refresh`.
let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempts to refresh the session via the httpOnly refresh-token cookie.
 * Not exported from the module's public surface beyond this file/http-client
 * consumers — the rest of the app should never need to call this directly.
 */
export function refreshSession(): Promise<boolean> {
  if (refreshPromise === null) {
    refreshPromise = apiFetch('/auth/refresh', { method: 'POST', skipAuthRetry: true })
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuthRetry, ...rest } = options;
  const requestInit = buildRequestInit(rest);
  const response = await fetch(`${API_PREFIX}${path}`, requestInit);

  if (response.status === 401 && !skipAuthRetry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, skipAuthRetry: true });
    }
    // Refresh failed — propagate the ORIGINAL 401 rather than a different
    // error shape.
    throw new ApiError(response.status, await parseBody(response));
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseBody(response));
  }

  return (await parseBody(response)) as T;
}
