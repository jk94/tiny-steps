import { apiFetch } from './http-client';

/**
 * Mirrors the backend's `AuthenticatedUser` (see
 * `apps/backend/src/auth/types/authenticated-request.ts`). `createdAt` is a
 * `Date` on the backend TS type but arrives as an ISO string over JSON.
 */
export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

interface AuthResponse {
  user: AuthUser;
}

export function register(email: string, password: string): Promise<AuthResponse> {
  // 401 from register/login means "invalid credentials"/"email in use",
  // never "expired access token" — never route it through the refresh flow.
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password },
    skipAuthRetry: true,
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuthRetry: true,
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}

export function fetchMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me', { method: 'GET' });
}
