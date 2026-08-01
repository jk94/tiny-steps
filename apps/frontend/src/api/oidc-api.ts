import { apiFetch } from './http-client';

export interface OidcProvider {
  id: string;
  displayName: string;
}

interface OidcProvidersResponse {
  providers: OidcProvider[];
}

export async function fetchOidcProviders(): Promise<OidcProvider[]> {
  const response = await apiFetch<OidcProvidersResponse>('/auth/oidc/providers');
  return response.providers;
}
