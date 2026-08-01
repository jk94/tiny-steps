import { apiFetch } from './http-client';

/**
 * Mirrors the backend's `HouseholdSummary` (see
 * `apps/backend/src/household/household.service.ts`). `createdAt` is a
 * `Date` on the backend TS type but arrives as an ISO string over JSON.
 */
export interface HouseholdSummary {
  id: string;
  name: string;
  role: 'OWNER' | 'CO_PARENT';
  createdAt: string;
}

export interface CreatedInvite {
  token: string;
  expiresAt: string;
}

export function createHousehold(name: string): Promise<HouseholdSummary> {
  return apiFetch<HouseholdSummary>('/households', {
    method: 'POST',
    body: { name },
  });
}

export function listHouseholds(): Promise<HouseholdSummary[]> {
  return apiFetch<HouseholdSummary[]>('/households');
}

export function fetchHousehold(householdId: string): Promise<HouseholdSummary> {
  return apiFetch<HouseholdSummary>(`/households/${householdId}`);
}

export function createInvite(householdId: string): Promise<CreatedInvite> {
  return apiFetch<CreatedInvite>(`/households/${householdId}/invites`, {
    method: 'POST',
  });
}
