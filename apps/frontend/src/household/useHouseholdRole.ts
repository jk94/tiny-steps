import { useQuery } from '@tanstack/react-query';
import { fetchHousehold, type HouseholdSummary } from '../api/household-api';
import type { HouseholdRole } from '../lib/householdPermissions';

export interface UseHouseholdRoleResult {
  /** `undefined` while loading, on error, or without a household id. */
  role: HouseholdRole | undefined;
  household: HouseholdSummary | undefined;
  isLoading: boolean;
}

/**
 * The signed-in user's role in a household, for role-gating UI deep inside
 * child-scoped screens that have a `householdId` in the route but no household
 * object at hand.
 *
 * Uses the exact same `['households', householdId]` query key as
 * `HouseholdDetail`, so both share one cache entry and no screen pays for a
 * second request. Gating is UX only — the backend `@RequireRole` guard remains
 * the authorization boundary.
 */
export function useHouseholdRole(householdId: string | undefined): UseHouseholdRoleResult {
  const { data, isLoading } = useQuery({
    queryKey: ['households', householdId],
    queryFn: () => fetchHousehold(householdId!),
    enabled: !!householdId,
    retry: false,
  });

  return { role: data?.role, household: data, isLoading };
}
