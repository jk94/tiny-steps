import { apiFetch } from './http-client';

/**
 * Client for the milestone endpoints (roadmap Phase 7.2).
 *
 * Deliberately **online-only**: nothing here imports from `src/offline/`, and
 * there is no optimistic wrapper alongside the plain calls the way
 * `feeding-api.ts` has. Without connectivity a save must visibly fail rather
 * than be buffered and later replayed (M-15) — a milestone is a deliberate,
 * once-in-a-lifetime entry made in the evening with photos attached, not
 * something a parent taps one-handed at 3am, and faking a successful photo
 * upload would be the worst possible lie to tell about a memory.
 */

export type MilestoneCategory = 'MOTOR' | 'LANGUAGE' | 'SOCIAL' | 'PHYSICAL';

/**
 * One photo of a milestone. Deliberately carries no path: the stored location
 * never leaves the server (M-8) — use `milestonePhotoUrl()` to render it.
 */
export interface MilestonePhotoRef {
  id: string;
  sortIndex: number;
  mimeType: string;
}

/**
 * Mirrors the backend's `MilestoneSummary` (see
 * `apps/backend/src/milestone/milestone.service.ts`). Dates arrive as ISO
 * strings; `achievedAt` is a calendar day stored as UTC midnight, so read it
 * through `lib/calendarDate.ts` rather than `new Date()`.
 */
export interface MilestoneSummary {
  id: string;
  childId: string;
  userId: string;
  /** `null` for a free entry. */
  templateKey: string | null;
  /** Always set, frozen at creation time — never re-translated on read. */
  title: string;
  category: MilestoneCategory | null;
  achievedAt: string;
  ageInDaysAtMilestone: number;
  ageInMonthsAtMilestone: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  photos: MilestonePhotoRef[];
}

/**
 * Request body for create — mirrors `CreateMilestoneDto`.
 *
 * `title` is required for both kinds of entry: for a template one the client
 * sends the *translated catalog label*, which the server then freezes.
 * `category` must be omitted for a template entry — the server derives it from
 * the catalog and rejects a client-sent one.
 */
export interface CreateMilestoneInput {
  templateKey?: string | null;
  title: string;
  category?: MilestoneCategory | null;
  /** `YYYY-MM-DD`. */
  achievedAt: string;
  note?: string | null;
}

/**
 * Request body for update — mirrors `UpdateMilestoneDto`. Genuinely partial;
 * an explicit `null` clears a field where the key alone means "leave it".
 * `templateKey` is absent on purpose: it is not editable. `title`/`category`
 * are rejected by the server on a template entry.
 *
 * No `clientTimestamp`: there is no offline buffering, so ADR-0011's
 * Last-Write-Wins never applies here.
 */
export interface UpdateMilestoneInput {
  title?: string;
  category?: MilestoneCategory | null;
  achievedAt?: string;
  note?: string | null;
}

export interface MilestoneRange {
  from?: string;
  to?: string;
}

function milestonesPath(householdId: string, childId: string): string {
  return `/households/${householdId}/children/${childId}/milestones`;
}

/** Query key for a child's milestone list, following the repo convention. */
export function milestonesQueryKey(householdId: string, childId: string) {
  return ['households', householdId, 'children', childId, 'milestones'] as const;
}

/** Query key for a single milestone — a descendant of the list key, so a
 * create/update/delete invalidation reaches it too. */
export function milestoneQueryKey(householdId: string, childId: string, milestoneId: string) {
  return [...milestonesQueryKey(householdId, childId), milestoneId] as const;
}

export function listMilestones(
  householdId: string,
  childId: string,
  range: MilestoneRange = {},
): Promise<MilestoneSummary[]> {
  const params = new URLSearchParams();
  if (range.from) {
    params.set('from', range.from);
  }
  if (range.to) {
    params.set('to', range.to);
  }
  const query = params.toString();
  return apiFetch<MilestoneSummary[]>(
    query
      ? `${milestonesPath(householdId, childId)}?${query}`
      : milestonesPath(householdId, childId),
  );
}

export function fetchMilestone(
  householdId: string,
  childId: string,
  milestoneId: string,
): Promise<MilestoneSummary> {
  return apiFetch<MilestoneSummary>(`${milestonesPath(householdId, childId)}/${milestoneId}`);
}

export function createMilestone(
  householdId: string,
  childId: string,
  input: CreateMilestoneInput,
): Promise<MilestoneSummary> {
  return apiFetch<MilestoneSummary>(milestonesPath(householdId, childId), {
    method: 'POST',
    body: { ...input },
  });
}

export function updateMilestone(
  householdId: string,
  childId: string,
  milestoneId: string,
  input: UpdateMilestoneInput,
): Promise<MilestoneSummary> {
  return apiFetch<MilestoneSummary>(`${milestonesPath(householdId, childId)}/${milestoneId}`, {
    method: 'PATCH',
    body: { ...input },
  });
}

/** Hard delete; the endpoint answers 204 with an empty body. */
export function deleteMilestone(
  householdId: string,
  childId: string,
  milestoneId: string,
): Promise<void> {
  return apiFetch<void>(`${milestonesPath(householdId, childId)}/${milestoneId}`, {
    method: 'DELETE',
  });
}

/**
 * Uploads one photo. `apiFetch` passes `FormData` through untouched (no JSON
 * serialization, no forced Content-Type) and still attaches the CSRF header.
 *
 * One request per file on purpose: a failed upload then only affects its own
 * file, which is what lets the form report a per-file error and keep the rest
 * (M-15).
 */
export function uploadMilestonePhoto(
  householdId: string,
  childId: string,
  milestoneId: string,
  file: File,
): Promise<MilestonePhotoRef> {
  const formData = new FormData();
  formData.append('photo', file);
  return apiFetch<MilestonePhotoRef>(
    `${milestonesPath(householdId, childId)}/${milestoneId}/photos`,
    { method: 'POST', body: formData },
  );
}

export function deleteMilestonePhoto(
  householdId: string,
  childId: string,
  milestoneId: string,
  photoId: string,
): Promise<void> {
  return apiFetch<void>(
    `${milestonesPath(householdId, childId)}/${milestoneId}/photos/${photoId}`,
    { method: 'DELETE' },
  );
}

/**
 * Plain path builder, NOT routed through `apiFetch` — consumed directly as an
 * `<img src>`, so the browser sends the auth cookies itself on the same-origin
 * request. Mirrors `childPhotoUrl()`, but needs no cache-busting parameter: a
 * photo id addresses immutable bytes (a replaced photo is a new row with a new
 * id), so the URL can be cached indefinitely.
 */
export function milestonePhotoUrl(
  householdId: string,
  childId: string,
  milestoneId: string,
  photoId: string,
): string {
  return `/api/households/${householdId}/children/${childId}/milestones/${milestoneId}/photos/${photoId}`;
}
