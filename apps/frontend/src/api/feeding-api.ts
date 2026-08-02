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
): Promise<FeedingEventSummary> {
  return apiFetch<FeedingEventSummary>(
    `${feedingEventsPath(householdId, childId)}/${eventId}/stop`,
    { method: 'POST' },
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
