import { createEventOptimistically } from '../offline/createEventOptimistically';
import { updateEventOptimistically } from '../offline/updateEventOptimistically';
import { apiFetch } from './http-client';

export type FeedingType = 'BREAST' | 'BOTTLE' | 'SOLID';
export type FeedingSide = 'LEFT' | 'RIGHT';

/**
 * Mirrors the backend's `FeedingEventSummary` (see
 * `apps/backend/src/feeding/feeding.service.ts`). Date fields are `Date` on
 * the backend TS type but arrive as ISO strings over JSON.
 */
export interface FeedingEventSummary {
  id: string;
  childId: string;
  userId: string;
  type: 'FEEDING';
  feedingType: FeedingType;
  occurredAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  side: FeedingSide | null;
  amountMl: number | null;
  note: string | null;
  createdAt: string;
  /** Server-side last-write timestamp; the Last-Write-Wins baseline echoed back
   * as `clientTimestamp` on an offline edit/stop — see ADR-0011. */
  updatedAt: string;
}

/**
 * Request body for create — mirrors `CreateFeedingEventDto`. Fields
 * irrelevant to `feedingType` (e.g. `side` alongside `feedingType:
 * 'BOTTLE'`) are silently discarded server-side, not rejected — see
 * `FeedingService.create`.
 */
export interface CreateFeedingEventInput {
  feedingType: FeedingType;
  occurredAt?: string;
  startedAt?: string;
  endedAt?: string;
  side?: FeedingSide;
  amountMl?: number;
  note?: string;
}

/**
 * Request body for update — same fields as create minus `feedingType`
 * (immutable after creation, see `UpdateFeedingEventDto`). All optional,
 * genuinely partial: only changed fields need to be included.
 *
 * `note` is widened to `string | null` here (unlike
 * `CreateFeedingEventInput.note`): omitting the key means "don't touch this
 * field", while an explicit `null` means "clear it" — see
 * `UpdateFeedingEventDto`.
 */
export type UpdateFeedingEventInput = Omit<CreateFeedingEventInput, 'feedingType' | 'note'> & {
  note?: string | null;
  /** Wall-clock instant the edit was submitted; activates Last-Write-Wins
   * server-side when present — see ADR-0011. */
  clientTimestamp?: string;
};

function feedingEventsPath(householdId: string, childId: string): string {
  return `/households/${householdId}/children/${childId}/feeding-events`;
}

export function createFeedingEvent(
  householdId: string,
  childId: string,
  input: CreateFeedingEventInput,
): Promise<FeedingEventSummary> {
  return apiFetch<FeedingEventSummary>(feedingEventsPath(householdId, childId), {
    method: 'POST',
    body: { ...input },
  });
}

export function listFeedingEvents(
  householdId: string,
  childId: string,
): Promise<FeedingEventSummary[]> {
  return apiFetch<FeedingEventSummary[]>(feedingEventsPath(householdId, childId));
}

export function fetchFeedingEvent(
  householdId: string,
  childId: string,
  eventId: string,
): Promise<FeedingEventSummary> {
  return apiFetch<FeedingEventSummary>(`${feedingEventsPath(householdId, childId)}/${eventId}`);
}

export function fetchActiveFeedingTimer(
  householdId: string,
  childId: string,
): Promise<FeedingEventSummary | null> {
  return apiFetch<FeedingEventSummary | null>(
    `${feedingEventsPath(householdId, childId)}/active-timer`,
  );
}

export function updateFeedingEvent(
  householdId: string,
  childId: string,
  eventId: string,
  input: UpdateFeedingEventInput,
): Promise<FeedingEventSummary> {
  return apiFetch<FeedingEventSummary>(`${feedingEventsPath(householdId, childId)}/${eventId}`, {
    method: 'PATCH',
    body: { ...input },
  });
}

export function stopFeedingTimer(
  householdId: string,
  childId: string,
  eventId: string,
  clientTimestamp?: string,
): Promise<FeedingEventSummary> {
  return apiFetch<FeedingEventSummary>(
    `${feedingEventsPath(householdId, childId)}/${eventId}/stop`,
    { method: 'POST', body: clientTimestamp !== undefined ? { clientTimestamp } : undefined },
  );
}

export function deleteFeedingEvent(
  householdId: string,
  childId: string,
  eventId: string,
): Promise<void> {
  return apiFetch<void>(`${feedingEventsPath(householdId, childId)}/${eventId}`, {
    method: 'DELETE',
  });
}

/**
 * Synthesizes the optimistic row shown before the server confirms. Mirrors the
 * backend's `startedAt`/`occurredAt` defaulting precedence (see
 * `FeedingService.create`): only BREAST is timer-based, so `startedAt` defaults
 * to `startedAt ?? occurredAt ?? now` for BREAST and is `null` otherwise;
 * `occurredAt` defaults to `occurredAt ?? startedAt ?? now`. `durationSeconds`
 * is null (no `endedAt` yet on a freshly-created entry).
 */
function buildOptimisticFeedingSummary(
  localId: string,
  childId: string,
  userId: string,
  input: CreateFeedingEventInput,
): FeedingEventSummary {
  const now = new Date().toISOString();
  const isBreast = input.feedingType === 'BREAST';
  const startedAt = isBreast ? (input.startedAt ?? input.occurredAt ?? now) : null;
  const occurredAt = input.occurredAt ?? startedAt ?? now;
  return {
    id: localId,
    childId,
    userId,
    type: 'FEEDING',
    feedingType: input.feedingType,
    occurredAt,
    startedAt,
    endedAt: null,
    durationSeconds: null,
    side: input.side ?? null,
    amountMl: input.amountMl ?? null,
    note: input.note ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Offline-aware wrapper around `createFeedingEvent`: buffers the new entry
 * locally and shows it immediately, then fires the real request (see
 * `createEventOptimistically`).
 */
export function createFeedingEventOptimistic(
  householdId: string,
  childId: string,
  userId: string,
  input: CreateFeedingEventInput,
): Promise<FeedingEventSummary> {
  return createEventOptimistically({
    householdId,
    childId,
    eventType: 'FEEDING',
    buildOptimisticSummary: (localId) =>
      buildOptimisticFeedingSummary(localId, childId, userId, input),
    apiCall: () => createFeedingEvent(householdId, childId, input),
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
 * an explicit `note: null` clears it. `durationSeconds` is re-derived so a
 * start/end edit reflects instantly.
 */
export function buildOptimisticFeedingUpdateSummary(
  current: FeedingEventSummary,
  input: UpdateFeedingEventInput,
): FeedingEventSummary {
  const startedAt = input.startedAt !== undefined ? input.startedAt : current.startedAt;
  const endedAt = input.endedAt !== undefined ? input.endedAt : current.endedAt;
  return {
    ...current,
    occurredAt: input.occurredAt ?? current.occurredAt,
    startedAt,
    endedAt,
    durationSeconds: deriveDurationSeconds(startedAt, endedAt),
    side: input.side !== undefined ? input.side : current.side,
    amountMl: input.amountMl !== undefined ? input.amountMl : current.amountMl,
    note: input.note !== undefined ? (input.note ?? null) : current.note,
  };
}

/** Optimistic summary for a timer-stop: sets `endedAt` to the stop instant and
 * re-derives the now-known duration. */
function buildOptimisticFeedingStopSummary(
  current: FeedingEventSummary,
  clientTimestamp: string,
): FeedingEventSummary {
  return {
    ...current,
    endedAt: clientTimestamp,
    durationSeconds: deriveDurationSeconds(current.startedAt, clientTimestamp),
  };
}

/**
 * Offline-aware wrapper around `updateFeedingEvent`: buffers the edit locally and
 * shows it immediately, then fires the PATCH (see `updateEventOptimistically`).
 * `input` must already carry the `clientTimestamp` the caller captured at submit.
 */
export function updateFeedingEventOptimistic(
  householdId: string,
  childId: string,
  current: FeedingEventSummary,
  input: UpdateFeedingEventInput,
): Promise<FeedingEventSummary> {
  return updateEventOptimistically({
    householdId,
    childId,
    eventType: 'FEEDING',
    targetEventId: current.id,
    operation: 'update',
    buildOptimisticSummary: () => buildOptimisticFeedingUpdateSummary(current, input),
    apiCall: () => updateFeedingEvent(householdId, childId, current.id, input),
    updateInput: input,
  });
}

/** Offline-aware wrapper around `stopFeedingTimer`, mirroring
 * `updateFeedingEventOptimistic` for the timer-stop operation. */
export function stopFeedingTimerOptimistic(
  householdId: string,
  childId: string,
  current: FeedingEventSummary,
  clientTimestamp: string,
): Promise<FeedingEventSummary> {
  return updateEventOptimistically({
    householdId,
    childId,
    eventType: 'FEEDING',
    targetEventId: current.id,
    operation: 'stop',
    buildOptimisticSummary: () => buildOptimisticFeedingStopSummary(current, clientTimestamp),
    apiCall: () => stopFeedingTimer(householdId, childId, current.id, clientTimestamp),
    updateInput: { clientTimestamp },
  });
}
