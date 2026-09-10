import { apiFetch } from './http-client';

/**
 * Client for the growth-measurement endpoints (roadmap Phase 7.1).
 *
 * Deliberately **online-only**: nothing here imports from `src/offline/`, and
 * there is no optimistic wrapper alongside the plain calls the way
 * `feeding-api.ts` has. Without connectivity a save must visibly fail rather
 * than be buffered and later replayed (W-16) — a growth measurement is a
 * deliberate, low-frequency entry made after a check-up, not something a
 * parent taps one-handed at 3am, so the offline machinery buys nothing here
 * and would add a whole conflict surface for free.
 */

export type GrowthIndicator =
  'WEIGHT_FOR_AGE' | 'LENGTH_OR_HEIGHT_FOR_AGE' | 'HEAD_CIRCUMFERENCE_FOR_AGE';

/** Manual override of the WHO body-measure method; null means "derive from age". */
export type LengthMeasurementPosition = 'LYING' | 'STANDING';

export type BodyMeasureReference = 'LENGTH' | 'HEIGHT';

/** Why a percentile could not be computed — surfaced to the user, never hidden. */
export type GrowthPercentileUnavailableReason =
  'CHILD_SEX_NOT_SET' | 'AGE_BELOW_REFERENCE_RANGE' | 'AGE_ABOVE_REFERENCE_RANGE';

export type GrowthPercentile =
  | { status: 'COMPUTED'; zScore: number; percentile: number }
  | { status: 'UNAVAILABLE'; reason: GrowthPercentileUnavailableReason };

/**
 * Mirrors the backend's `GrowthMeasurementSummary` (see
 * `apps/backend/src/growth/growth.service.ts`). Date fields are `Date` there
 * but arrive as ISO strings over JSON.
 */
export interface GrowthMeasurementSummary {
  id: string;
  childId: string;
  userId: string;
  measuredAt: string;
  ageInDaysAtMeasurement: number;
  weightGrams: number | null;
  lengthMillimeters: number | null;
  headCircumferenceMillimeters: number | null;
  lengthMeasurementPosition: LengthMeasurementPosition | null;
  effectiveLengthMeasurementPosition: LengthMeasurementPosition | null;
  lengthOrHeightReferenceUsed: BodyMeasureReference | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  percentiles: {
    weight: GrowthPercentile | null;
    length: GrowthPercentile | null;
    headCircumference: GrowthPercentile | null;
  };
}

/** Request body for create — mirrors `CreateGrowthMeasurementDto`. */
export interface CreateGrowthMeasurementInput {
  measuredAt: string;
  weightGrams?: number;
  lengthMillimeters?: number;
  headCircumferenceMillimeters?: number;
  lengthMeasurementPosition?: LengthMeasurementPosition;
  note?: string;
}

/**
 * Request body for update — mirrors `UpdateGrowthMeasurementDto`. The
 * nullable fields distinguish "leave untouched" (key absent) from "clear it"
 * (explicit `null`). No `clientTimestamp`: there is no offline buffering, so
 * ADR-0011's Last-Write-Wins never applies here.
 */
export type UpdateGrowthMeasurementInput = Partial<
  Pick<CreateGrowthMeasurementInput, 'measuredAt'>
> & {
  weightGrams?: number | null;
  lengthMillimeters?: number | null;
  headCircumferenceMillimeters?: number | null;
  lengthMeasurementPosition?: LengthMeasurementPosition | null;
  note?: string | null;
};

/** One WHO percentile curve, sampled on a fixed age grid. */
export interface GrowthReferenceCurve {
  percentile: number;
  zScore: number;
  points: { ageInDays: number; value: number }[];
}

export type GrowthReferenceResponse =
  | {
      indicator: GrowthIndicator;
      sex: null;
      available: false;
      reason: 'CHILD_SEX_NOT_SET';
    }
  | {
      indicator: GrowthIndicator;
      sex: 'FEMALE' | 'MALE';
      available: true;
      xUnit: 'DAYS';
      unit: 'GRAMS' | 'MILLIMETERS';
      ageRangeDays: [number, number];
      stepDays: number;
      lengthToHeightBoundaryDays: number;
      curves: GrowthReferenceCurve[];
    };

export interface GrowthRange {
  from?: string;
  to?: string;
}

function growthPath(householdId: string, childId: string): string {
  return `/households/${householdId}/children/${childId}/growth`;
}

/** Query key for a child's measurement list, following the repo convention. */
export function growthQueryKey(householdId: string, childId: string) {
  return ['households', householdId, 'children', childId, 'growth'] as const;
}

/**
 * Query key for one indicator's reference bands.
 *
 * Deliberately a **sibling** of `growthQueryKey`, not a descendant: the bands
 * are vendored WHO data, so a create/update/delete must not drag them into its
 * prefix-based invalidation and refetch a ~250-point-per-curve payload that
 * cannot have changed.
 */
export function growthReferenceQueryKey(
  householdId: string,
  childId: string,
  indicator: GrowthIndicator,
) {
  return ['households', householdId, 'children', childId, 'growth-reference', indicator] as const;
}

export function listGrowthMeasurements(
  householdId: string,
  childId: string,
  range: GrowthRange = {},
): Promise<GrowthMeasurementSummary[]> {
  const params = new URLSearchParams();
  if (range.from) {
    params.set('from', range.from);
  }
  if (range.to) {
    params.set('to', range.to);
  }
  const query = params.toString();
  return apiFetch<GrowthMeasurementSummary[]>(
    query ? `${growthPath(householdId, childId)}?${query}` : growthPath(householdId, childId),
  );
}

export function fetchGrowthMeasurement(
  householdId: string,
  childId: string,
  measurementId: string,
): Promise<GrowthMeasurementSummary> {
  return apiFetch<GrowthMeasurementSummary>(`${growthPath(householdId, childId)}/${measurementId}`);
}

export function createGrowthMeasurement(
  householdId: string,
  childId: string,
  input: CreateGrowthMeasurementInput,
): Promise<GrowthMeasurementSummary> {
  return apiFetch<GrowthMeasurementSummary>(growthPath(householdId, childId), {
    method: 'POST',
    body: { ...input },
  });
}

export function updateGrowthMeasurement(
  householdId: string,
  childId: string,
  measurementId: string,
  input: UpdateGrowthMeasurementInput,
): Promise<GrowthMeasurementSummary> {
  return apiFetch<GrowthMeasurementSummary>(
    `${growthPath(householdId, childId)}/${measurementId}`,
    { method: 'PATCH', body: { ...input } },
  );
}

/** Hard delete (W-8); the endpoint answers 204 with an empty body. */
export function deleteGrowthMeasurement(
  householdId: string,
  childId: string,
  measurementId: string,
): Promise<void> {
  return apiFetch<void>(`${growthPath(householdId, childId)}/${measurementId}`, {
    method: 'DELETE',
  });
}

export function fetchGrowthReference(
  householdId: string,
  childId: string,
  indicator: GrowthIndicator,
): Promise<GrowthReferenceResponse> {
  return apiFetch<GrowthReferenceResponse>(
    `${growthPath(householdId, childId)}/reference?indicator=${indicator}`,
  );
}
