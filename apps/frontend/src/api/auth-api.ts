import { apiFetch } from './http-client';

/**
 * Mirrors the backend's `AuthenticatedUser` (see
 * `apps/backend/src/auth/types/authenticated-request.ts`). `createdAt` is a
 * `Date` on the backend TS type but arrives as an ISO string over JSON.
 */
export interface AuthUser {
  id: string;
  email: string;
  /**
   * `null` for accounts created before the name became mandatory and for OIDC
   * logins whose ID token carried no `name` claim — the app then forces the
   * user to supply one (see `components/MandatoryNameDialog.tsx`).
   */
  name: string | null;
  createdAt: string;
}

interface AuthResponse {
  user: AuthUser;
}

export function register(email: string, password: string, name: string): Promise<AuthResponse> {
  // 401 from register/login means "invalid credentials"/"email in use",
  // never "expired access token" — never route it through the refresh flow.
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, name },
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

/** Updates the signed-in user's display name, returning the refreshed user. */
export function updateMe(name: string): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me', { method: 'PATCH', body: { name } });
}
