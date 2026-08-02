import { apiFetch } from './http-client';

/**
 * Mirrors the backend's `SleepEventSummary` (see
 * `apps/backend/src/sleep/sleep.service.ts`). Date fields are `Date` on the
 * backend TS type but arrive as ISO strings over JSON. Unlike
 * `FeedingEventSummary`, there's no type-specific fields (no detail table
 * — see ADR-0006's addendum) — this is a pure base-Event shape.
 */
export interface SleepEventSummary {
  id: string;
  childId: string;
  userId: string;
  type: 'SLEEP';
  occurredAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
}

/** Request body for create — mirrors `CreateSleepEventDto`. */
export interface CreateSleepEventInput {
  occurredAt?: string;
  startedAt?: string;
  endedAt?: string;
}

/**
 * Request body for update — mirrors `UpdateSleepEventDto`. Structurally
 * identical to `CreateSleepEventInput` (no field to omit, unlike Feeding's
 * immutable `feedingType`), kept as a distinct alias only for symmetry with
 * the create/update split.
 */
export type UpdateSleepEventInput = CreateSleepEventInput;

function sleepEventsPath(householdId: string, childId: string): string {
  return `/households/${householdId}/children/${childId}/sleep-events`;
}

export function createSleepEvent(
  householdId: string,
  childId: string,
  input: CreateSleepEventInput,
): Promise<SleepEventSummary> {
  return apiFetch<SleepEventSummary>(sleepEventsPath(householdId, childId), {
    method: 'POST',
    body: { ...input },
  });
}

export function listSleepEvents(
  householdId: string,
  childId: string,
): Promise<SleepEventSummary[]> {
  return apiFetch<SleepEventSummary[]>(sleepEventsPath(householdId, childId));
}

export function fetchSleepEvent(
  householdId: string,
  childId: string,
  eventId: string,
): Promise<SleepEventSummary> {
  return apiFetch<SleepEventSummary>(`${sleepEventsPath(householdId, childId)}/${eventId}`);
}

export function fetchActiveSleepTimer(
  householdId: string,
  childId: string,
): Promise<SleepEventSummary | null> {
  return apiFetch<SleepEventSummary | null>(
    `${sleepEventsPath(householdId, childId)}/active-timer`,
  );
}

export function updateSleepEvent(
  householdId: string,
  childId: string,
  eventId: string,
  input: UpdateSleepEventInput,
): Promise<SleepEventSummary> {
  return apiFetch<SleepEventSummary>(`${sleepEventsPath(householdId, childId)}/${eventId}`, {
    method: 'PATCH',
    body: { ...input },
  });
}

export function stopSleepTimer(
  householdId: string,
  childId: string,
  eventId: string,
): Promise<SleepEventSummary> {
  return apiFetch<SleepEventSummary>(`${sleepEventsPath(householdId, childId)}/${eventId}/stop`, {
    method: 'POST',
  });
}

export function deleteSleepEvent(
  householdId: string,
  childId: string,
  eventId: string,
): Promise<void> {
  return apiFetch<void>(`${sleepEventsPath(householdId, childId)}/${eventId}`, {
    method: 'DELETE',
  });
}
