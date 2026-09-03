import { apiFetch } from './http-client';

/**
 * Client for the medication/vaccination endpoints (roadmap Phase 7.3).
 *
 * Deliberately **online-only**: nothing here imports from `src/offline/`, and
 * there is no optimistic wrapper alongside the plain calls the way
 * `feeding-api.ts` has. Without connectivity a save must visibly fail rather
 * than be buffered and later replayed (MED-15) — "did the baby already get
 * that dose?" is the last question an app should answer with a guess.
 */

export type HealthRecordKind = 'MEDICATION' | 'VACCINATION';

/** The two states the overview splits into (MED-12). */
export type HealthRecordStatus = 'planned' | 'done';

/**
 * Mirrors the backend's `HealthRecordSummary` (see
 * `apps/backend/src/health-record/health-record.service.ts`). Dates arrive as
 * ISO strings; `administeredAt` is a real instant, while `dueAt` is a calendar
 * day stored as UTC midnight — read that one through `lib/calendarDate.ts`
 * rather than `new Date()`.
 *
 * `reminderLastSentAt` is absent on purpose: it is server-side scheduler
 * bookkeeping and never leaves the backend.
 */
export interface HealthRecordSummary {
  id: string;
  childId: string;
  userId: string;
  kind: HealthRecordKind;
  name: string;
  administeredAt: string | null;
  dueAt: string | null;
  doseAmount: number | null;
  doseUnit: string | null;
  vaccineBatch: string | null;
  note: string | null;
  reminderEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request body for create — mirrors `CreateHealthRecordDto`.
 *
 * At least one of `administeredAt`/`dueAt` must be present (MED-2), the dose
 * fields are only valid for a `MEDICATION` and `vaccineBatch` only for a
 * `VACCINATION` — all enforced server-side, and pre-checked by the form so the
 * user hears about it before the round-trip.
 */
export interface CreateHealthRecordInput {
  kind: HealthRecordKind;
  name: string;
  /** Full ISO-8601 instant. */
  administeredAt?: string;
  /** `YYYY-MM-DD`. */
  dueAt?: string;
  doseAmount?: number;
  doseUnit?: string;
  vaccineBatch?: string;
  note?: string;
  reminderEnabled?: boolean;
}

/**
 * Request body for update — mirrors `UpdateHealthRecordDto`. Genuinely partial;
 * an explicit `null` clears a field where the key alone means "leave it".
 *
 * `kind` is absent on purpose: it is not editable. This is also the shape
 * "mark as done" (MED-5) uses — `{ administeredAt: <now> }` and nothing else.
 *
 * No `clientTimestamp`: there is no offline buffering, so ADR-0011's
 * Last-Write-Wins never applies here.
 */
export interface UpdateHealthRecordInput {
  name?: string;
  administeredAt?: string | null;
  dueAt?: string | null;
  doseAmount?: number | null;
  doseUnit?: string | null;
  vaccineBatch?: string | null;
  note?: string | null;
  reminderEnabled?: boolean;
}

export interface HealthRecordFilter {
  kind?: HealthRecordKind;
  status?: HealthRecordStatus;
}

function healthRecordsPath(householdId: string, childId: string): string {
  return `/households/${householdId}/children/${childId}/health-records`;
}

/** Query key for a child's health-record list, following the repo convention. */
export function healthRecordsQueryKey(householdId: string, childId: string) {
  return ['households', householdId, 'children', childId, 'health-records'] as const;
}

/** Query key for a single record — a descendant of the list key, so a
 * create/update/delete invalidation reaches it too. */
export function healthRecordQueryKey(householdId: string, childId: string, recordId: string) {
  return [...healthRecordsQueryKey(householdId, childId), recordId] as const;
}

/**
 * Both of MED-12's sections come from one unfiltered call — the split is a
 * presentation concern, and two filtered requests would just double the
 * latency of the overview.
 */
export function listHealthRecords(
  householdId: string,
  childId: string,
  filter: HealthRecordFilter = {},
): Promise<HealthRecordSummary[]> {
  const params = new URLSearchParams();
  if (filter.kind) {
    params.set('kind', filter.kind);
  }
  if (filter.status) {
    params.set('status', filter.status);
  }
  const query = params.toString();
  const path = healthRecordsPath(householdId, childId);
  return apiFetch<HealthRecordSummary[]>(query ? `${path}?${query}` : path);
}

export function fetchHealthRecord(
  householdId: string,
  childId: string,
  recordId: string,
): Promise<HealthRecordSummary> {
  return apiFetch<HealthRecordSummary>(`${healthRecordsPath(householdId, childId)}/${recordId}`);
}

export function createHealthRecord(
  householdId: string,
  childId: string,
  input: CreateHealthRecordInput,
): Promise<HealthRecordSummary> {
  return apiFetch<HealthRecordSummary>(healthRecordsPath(householdId, childId), {
    method: 'POST',
    body: { ...input },
  });
}

export function updateHealthRecord(
  householdId: string,
  childId: string,
  recordId: string,
  input: UpdateHealthRecordInput,
): Promise<HealthRecordSummary> {
  return apiFetch<HealthRecordSummary>(`${healthRecordsPath(householdId, childId)}/${recordId}`, {
    method: 'PATCH',
    body: { ...input },
  });
}

/** Hard delete; the endpoint answers 204 with an empty body. */
export function deleteHealthRecord(
  householdId: string,
  childId: string,
  recordId: string,
): Promise<void> {
  return apiFetch<void>(`${healthRecordsPath(householdId, childId)}/${recordId}`, {
    method: 'DELETE',
  });
}
