import type { HouseholdRole } from '../lib/householdPermissions';
import { apiFetch } from './http-client';

/**
 * Mirrors the backend's `HouseholdSummary` (see
 * `apps/backend/src/household/household.service.ts`). `createdAt` is a
 * `Date` on the backend TS type but arrives as an ISO string over JSON.
 */
export interface HouseholdSummary {
  id: string;
  name: string;
  role: HouseholdRole;
  createdAt: string;
}

export interface CreatedInvite {
  token: string;
  expiresAt: string;
}

/**
 * Mirrors the backend's `HouseholdMemberSummary` (see
 * `apps/backend/src/household/household.service.ts`). `name` is optional on
 * `User`, so `email` stays the always-present identifying field. `joinedAt` is
 * a `Date` on the backend TS type but arrives as an ISO string over JSON.
 */
export interface HouseholdMemberSummary {
  userId: string;
  email: string;
  name: string | null;
  role: HouseholdRole;
  joinedAt: string;
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

/**
 * Creates an invite link. `role` is optional: sending no body at all keeps the
 * backend's `CO_PARENT` default, which is also what pre-Phase-7.5 callers did.
 */
export function createInvite(householdId: string, role?: HouseholdRole): Promise<CreatedInvite> {
  return apiFetch<CreatedInvite>(`/households/${householdId}/invites`, {
    method: 'POST',
    body: role ? { role } : undefined,
  });
}

export function listHouseholdMembers(householdId: string): Promise<HouseholdMemberSummary[]> {
  return apiFetch<HouseholdMemberSummary[]>(`/households/${householdId}/members`);
}

/**
 * Changes another member's role (OWNER-only). `userId` is a `User.id` as
 * returned by `listHouseholdMembers`, never the internal `Membership.id`.
 */
export function changeMemberRole(
  householdId: string,
  userId: string,
  role: HouseholdRole,
): Promise<HouseholdMemberSummary> {
  return apiFetch<HouseholdMemberSummary>(`/households/${householdId}/members/${userId}`, {
    method: 'PATCH',
    body: { role },
  });
}

/** Removes another member from the household (OWNER-only). Responds 204. */
export function removeMember(householdId: string, userId: string): Promise<void> {
  return apiFetch<void>(`/households/${householdId}/members/${userId}`, {
    method: 'DELETE',
  });
}
