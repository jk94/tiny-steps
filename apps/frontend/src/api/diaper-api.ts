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
 */
export type UpdateDiaperEventInput = Partial<CreateDiaperEventInput>;

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
