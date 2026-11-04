import { apiFetch } from './http-client';

/**
 * The OAuth parameters Alexa puts on the consent page URL (`/alexa/link?…`),
 * relayed to the backend unchanged. Snake case on purpose: these are protocol
 * parameter names (RFC 6749), not app fields. See ADR-0017.
 */
export interface AlexaAuthorizationParams {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  state?: string;
  scope?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

const REQUIRED_PARAMS = ['client_id', 'redirect_uri', 'response_type'] as const;
const OPTIONAL_PARAMS = ['state', 'scope', 'code_challenge', 'code_challenge_method'] as const;

/**
 * Picks the known OAuth parameters out of the consent page's query string,
 * or `null` when a required one is missing. Unknown parameters are dropped —
 * the backend's DTO would reject them.
 */
export function readAlexaAuthorizationParams(
  search: URLSearchParams,
): AlexaAuthorizationParams | null {
  const params: Partial<Record<string, string>> = {};
  for (const name of [...REQUIRED_PARAMS, ...OPTIONAL_PARAMS]) {
    const value = search.get(name);
    if (value !== null && value !== '') {
      params[name] = value;
    }
  }
  return REQUIRED_PARAMS.every((name) => params[name] !== undefined)
    ? (params as unknown as AlexaAuthorizationParams)
    : null;
}

/** A child the user can pick as Alexa's default, across all their households. */
export interface AlexaChildOption {
  id: string;
  name: string;
  householdName: string;
}

export function describeAlexaAuthorization(
  params: AlexaAuthorizationParams,
): Promise<{ children: AlexaChildOption[] }> {
  const query = new URLSearchParams(params as unknown as Record<string, string>);
  return apiFetch<{ children: AlexaChildOption[] }>(`/alexa/oauth/authorize?${query}`);
}

/** Approve or deny; the backend answers with the URL to send the browser back to Alexa. */
export function decideAlexaAuthorization(
  params: AlexaAuthorizationParams,
  approve: boolean,
  defaultChildId: string | null,
): Promise<{ redirectTo: string }> {
  return apiFetch<{ redirectTo: string }>('/alexa/oauth/authorize', {
    method: 'POST',
    body: { ...params, approve, ...(approve ? { default_child_id: defaultChildId } : {}) },
  });
}

/** Mirrors the backend's `AlexaLinkView`. */
export interface AlexaLink {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  defaultChildId: string | null;
}

/** Mirrors the backend's `AlexaLinksOverview`. */
export interface AlexaLinksOverview {
  enabled: boolean;
  links: AlexaLink[];
  children: AlexaChildOption[];
}

export function fetchAlexaLinks(): Promise<AlexaLinksOverview> {
  return apiFetch<AlexaLinksOverview>('/alexa/links');
}

export function updateAlexaLinkDefaultChild(
  linkId: string,
  defaultChildId: string | null,
): Promise<AlexaLink> {
  return apiFetch<AlexaLink>(`/alexa/links/${encodeURIComponent(linkId)}`, {
    method: 'PATCH',
    body: { defaultChildId },
  });
}

export function deleteAlexaLink(linkId: string): Promise<void> {
  return apiFetch<void>(`/alexa/links/${encodeURIComponent(linkId)}`, { method: 'DELETE' });
}
