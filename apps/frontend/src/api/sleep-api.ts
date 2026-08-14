import { createEventOptimistically } from '../offline/createEventOptimistically';
import { updateEventOptimistically } from '../offline/updateEventOptimistically';
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
  /** Server-side last-write timestamp; the Last-Write-Wins baseline — see ADR-0011. */
  updatedAt: string;
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
export type UpdateSleepEventInput = CreateSleepEventInput & {
  /** Wall-clock instant the edit was submitted; activates Last-Write-Wins
   * server-side when present — see ADR-0011. */
  clientTimestamp?: string;
};

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
  clientTimestamp?: string,
): Promise<SleepEventSummary> {
  return apiFetch<SleepEventSummary>(`${sleepEventsPath(householdId, childId)}/${eventId}/stop`, {
    method: 'POST',
    body: clientTimestamp !== undefined ? { clientTimestamp } : undefined,
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

/**
 * Synthesizes the optimistic row shown before the server confirms. Mirrors the
 * backend's defaulting precedence (see `SleepService.create`): `startedAt`
 * defaults to `startedAt ?? occurredAt ?? now`, `occurredAt` to
 * `occurredAt ?? startedAt`. Sleep has no type branching. `durationSeconds` is
 * null (no `endedAt` yet on a freshly-created entry).
 */
function buildOptimisticSleepSummary(
  localId: string,
  childId: string,
  userId: string,
  input: CreateSleepEventInput,
): SleepEventSummary {
  const now = new Date().toISOString();
  const startedAt = input.startedAt ?? input.occurredAt ?? now;
  const occurredAt = input.occurredAt ?? startedAt;
  return {
    id: localId,
    childId,
    userId,
    type: 'SLEEP',
    occurredAt,
    startedAt,
    endedAt: null,
    durationSeconds: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Offline-aware wrapper around `createSleepEvent`: buffers the new entry locally
 * and shows it immediately, then fires the real request (see
 * `createEventOptimistically`).
 */
export function createSleepEventOptimistic(
  householdId: string,
  childId: string,
  userId: string,
  input: CreateSleepEventInput,
): Promise<SleepEventSummary> {
  return createEventOptimistically({
    householdId,
    childId,
    eventType: 'SLEEP',
    buildOptimisticSummary: (localId) =>
      buildOptimisticSleepSummary(localId, childId, userId, input),
    apiCall: () => createSleepEvent(householdId, childId, input),
    createInput: input,
  });
}

/** Recomputes `durationSeconds` from the effective start/end pair (both must be
 * present), mirroring the backend's read-time derivation. */
function deriveDurationSeconds(startedAt: string | null, endedAt: string | null): number | null {
  return startedAt && endedAt
    ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
    : null;
}

/**
 * Merges an edit's changed fields onto the current known summary to produce the
 * row shown immediately (JC-2). A field absent from `input` is left untouched;
 * `durationSeconds` is re-derived so a start/end edit reflects instantly.
 */
export function buildOptimisticSleepUpdateSummary(
  current: SleepEventSummary,
  input: UpdateSleepEventInput,
): SleepEventSummary {
  const startedAt = input.startedAt !== undefined ? input.startedAt : current.startedAt;
  const endedAt = input.endedAt !== undefined ? input.endedAt : current.endedAt;
  return {
    ...current,
    occurredAt: input.occurredAt ?? current.occurredAt,
    startedAt,
    endedAt,
    durationSeconds: deriveDurationSeconds(startedAt, endedAt),
  };
}

/** Optimistic summary for a timer-stop: sets `endedAt` to the stop instant and
 * re-derives the now-known duration. */
function buildOptimisticSleepStopSummary(
  current: SleepEventSummary,
  clientTimestamp: string,
): SleepEventSummary {
  return {
    ...current,
    endedAt: clientTimestamp,
    durationSeconds: deriveDurationSeconds(current.startedAt, clientTimestamp),
  };
}

/**
 * Offline-aware wrapper around `updateSleepEvent`: buffers the edit locally and
 * shows it immediately, then fires the PATCH (see `updateEventOptimistically`).
 * `input` must already carry the `clientTimestamp` the caller captured at submit.
 */
export function updateSleepEventOptimistic(
  householdId: string,
  childId: string,
  current: SleepEventSummary,
  input: UpdateSleepEventInput,
): Promise<SleepEventSummary> {
  return updateEventOptimistically({
    householdId,
    childId,
    eventType: 'SLEEP',
    targetEventId: current.id,
    operation: 'update',
    buildOptimisticSummary: () => buildOptimisticSleepUpdateSummary(current, input),
    apiCall: () => updateSleepEvent(householdId, childId, current.id, input),
    updateInput: input,
  });
}

/** Offline-aware wrapper around `stopSleepTimer`, mirroring
 * `updateSleepEventOptimistic` for the timer-stop operation. */
export function stopSleepTimerOptimistic(
  householdId: string,
  childId: string,
  current: SleepEventSummary,
  clientTimestamp: string,
): Promise<SleepEventSummary> {
  return updateEventOptimistically({
    householdId,
    childId,
    eventType: 'SLEEP',
    targetEventId: current.id,
    operation: 'stop',
    buildOptimisticSummary: () => buildOptimisticSleepStopSummary(current, clientTimestamp),
    apiCall: () => stopSleepTimer(householdId, childId, current.id, clientTimestamp),
    updateInput: { clientTimestamp },
  });
}
