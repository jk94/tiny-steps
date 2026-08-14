import { createEventOptimistically } from '../offline/createEventOptimistically';
import { updateEventOptimistically } from '../offline/updateEventOptimistically';
import { apiFetch } from './http-client';

export type DiaperType = 'PEE' | 'STOOL' | 'BOTH';

/**
 * Mirrors the backend's `DiaperEventSummary` (see
 * `apps/backend/src/diaper/diaper.service.ts`). Date fields are `Date` on
 * the backend TS type but arrive as ISO strings over JSON. No
 * `startedAt`/`endedAt`/`durationSeconds` — Diaper is always a point
 * event, never timer-based (unlike Feeding/Sleep).
 */
export interface DiaperEventSummary {
  id: string;
  childId: string;
  userId: string;
  type: 'DIAPER';
  diaperType: DiaperType;
  occurredAt: string;
  note: string | null;
  createdAt: string;
  /** Server-side last-write timestamp; the Last-Write-Wins baseline — see ADR-0011. */
  updatedAt: string;
}

/**
 * Request body for create — mirrors `CreateDiaperEventDto`.
 */
export interface CreateDiaperEventInput {
  diaperType: DiaperType;
  occurredAt?: string;
  note?: string;
}

/**
 * Request body for update — mirrors `UpdateDiaperEventDto`. Unlike
 * Feeding, `diaperType` IS included here (editable via PATCH, see
 * `UpdateDiaperEventDto`'s doc comment). All fields optional, genuinely
 * partial: only changed fields need to be included.
 *
 * `note` is widened to `string | null` here (unlike
 * `CreateDiaperEventInput.note`): omitting the key means "don't touch this
 * field", while an explicit `null` means "clear it" — see
 * `UpdateDiaperEventDto`.
 */
export type UpdateDiaperEventInput = Omit<Partial<CreateDiaperEventInput>, 'note'> & {
  note?: string | null;
  /** Wall-clock instant the edit was submitted; activates Last-Write-Wins
   * server-side when present — see ADR-0011. */
  clientTimestamp?: string;
};

function diaperEventsPath(householdId: string, childId: string): string {
  return `/households/${householdId}/children/${childId}/diaper-events`;
}

export function createDiaperEvent(
  householdId: string,
  childId: string,
  input: CreateDiaperEventInput,
): Promise<DiaperEventSummary> {
  return apiFetch<DiaperEventSummary>(diaperEventsPath(householdId, childId), {
    method: 'POST',
    body: { ...input },
  });
}

export function listDiaperEvents(
  householdId: string,
  childId: string,
): Promise<DiaperEventSummary[]> {
  return apiFetch<DiaperEventSummary[]>(diaperEventsPath(householdId, childId));
}

export function fetchDiaperEvent(
  householdId: string,
  childId: string,
  eventId: string,
): Promise<DiaperEventSummary> {
  return apiFetch<DiaperEventSummary>(`${diaperEventsPath(householdId, childId)}/${eventId}`);
}

export function updateDiaperEvent(
  householdId: string,
  childId: string,
  eventId: string,
  input: UpdateDiaperEventInput,
): Promise<DiaperEventSummary> {
  return apiFetch<DiaperEventSummary>(`${diaperEventsPath(householdId, childId)}/${eventId}`, {
    method: 'PATCH',
    body: { ...input },
  });
}

export function deleteDiaperEvent(
  householdId: string,
  childId: string,
  eventId: string,
): Promise<void> {
  return apiFetch<void>(`${diaperEventsPath(householdId, childId)}/${eventId}`, {
    method: 'DELETE',
  });
}

/**
 * Synthesizes the optimistic row shown before the server confirms. Mirrors the
 * backend's defaulting precedence (see `DiaperService.create`): `occurredAt`
 * defaults to `occurredAt ?? now`. Diaper is always a point event (never
 * timer-based), so there are no `startedAt`/`endedAt`/`durationSeconds` fields.
 */
function buildOptimisticDiaperSummary(
  localId: string,
  childId: string,
  userId: string,
  input: CreateDiaperEventInput,
): DiaperEventSummary {
  const now = new Date().toISOString();
  return {
    id: localId,
    childId,
    userId,
    type: 'DIAPER',
    diaperType: input.diaperType,
    occurredAt: input.occurredAt ?? now,
    note: input.note ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Offline-aware wrapper around `createDiaperEvent`: buffers the new entry
 * locally and shows it immediately, then fires the real request (see
 * `createEventOptimistically`).
 */
export function createDiaperEventOptimistic(
  householdId: string,
  childId: string,
  userId: string,
  input: CreateDiaperEventInput,
): Promise<DiaperEventSummary> {
  return createEventOptimistically({
    householdId,
    childId,
    eventType: 'DIAPER',
    buildOptimisticSummary: (localId) =>
      buildOptimisticDiaperSummary(localId, childId, userId, input),
    apiCall: () => createDiaperEvent(householdId, childId, input),
    createInput: input,
  });
}

/**
 * Merges an edit's changed fields onto the current known summary to produce the
 * row shown immediately (JC-2). A field absent from `input` is left untouched;
 * an explicit `note: null` clears it. Diaper is a point event, so there's no
 * duration to re-derive.
 */
export function buildOptimisticDiaperUpdateSummary(
  current: DiaperEventSummary,
  input: UpdateDiaperEventInput,
): DiaperEventSummary {
  return {
    ...current,
    diaperType: input.diaperType !== undefined ? input.diaperType : current.diaperType,
    occurredAt: input.occurredAt ?? current.occurredAt,
    note: input.note !== undefined ? (input.note ?? null) : current.note,
  };
}

/**
 * Offline-aware wrapper around `updateDiaperEvent`: buffers the edit locally and
 * shows it immediately, then fires the PATCH (see `updateEventOptimistically`).
 * `input` must already carry the `clientTimestamp` the caller captured at submit.
 */
export function updateDiaperEventOptimistic(
  householdId: string,
  childId: string,
  current: DiaperEventSummary,
  input: UpdateDiaperEventInput,
): Promise<DiaperEventSummary> {
  return updateEventOptimistically({
    householdId,
    childId,
    eventType: 'DIAPER',
    targetEventId: current.id,
    operation: 'update',
    buildOptimisticSummary: () => buildOptimisticDiaperUpdateSummary(current, input),
    apiCall: () => updateDiaperEvent(householdId, childId, current.id, input),
    updateInput: input,
  });
}
