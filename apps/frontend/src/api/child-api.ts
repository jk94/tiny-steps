import { apiFetch } from './http-client';

/**
 * Mirrors the backend's `ChildSummary` (see
 * `apps/backend/src/child/child.service.ts`). `birthDate`/`createdAt` are
 * `Date` on the backend TS type but arrive as ISO strings over JSON.
 */
export interface ChildSummary {
  id: string;
  householdId: string;
  name: string;
  birthDate: string;
  hasPhoto: boolean;
  /**
   * Optional; `null` means "not specified". Consumed only by the WHO growth
   * percentiles — without it the growth page shows values and trends but no
   * percentiles, with an explanatory hint (W-10).
   */
  sex: 'FEMALE' | 'MALE' | null;
  createdAt: string;
}

/**
 * Wire value that resets `sex` back to "not specified". `multipart/form-data`
 * cannot carry JSON `null`, so the backend reads the empty string as "clear
 * it" (see `CLEAR_CHILD_SEX` in the backend's update-child DTO).
 */
export const CLEAR_CHILD_SEX = '';

/**
 * Fields a create/update child form may submit. All optional — `ChildForm`
 * uses this shape for both `mode="create"` (where the form enforces
 * name/birthDate are actually filled before calling `buildChildFormData`)
 * and `mode="edit"` (genuinely partial: only changed fields are included).
 */
export interface ChildFormInput {
  name?: string;
  birthDate?: string;
  /** `'FEMALE' | 'MALE'`, or `CLEAR_CHILD_SEX` to reset it to "not specified". */
  sex?: string;
  photo?: File | null;
}

/**
 * Builds the `multipart/form-data` body for create/update requests. Only
 * appends fields that are actually provided — most importantly, `photo` is
 * omitted entirely (not sent as an empty value) when the caller isn't
 * replacing it, matching the backend's PATCH semantics: omitting the
 * `photo` field leaves the existing photo untouched (see `ChildController`,
 * there's no "remove photo" mechanism).
 */
export function buildChildFormData(input: ChildFormInput): FormData {
  const formData = new FormData();
  if (input.name !== undefined) {
    formData.append('name', input.name);
  }
  if (input.birthDate !== undefined) {
    formData.append('birthDate', input.birthDate);
  }
  // Sent even when empty, unlike `photo`: the empty string is a meaningful
  // value here ("not specified"), not an absent field.
  if (input.sex !== undefined) {
    formData.append('sex', input.sex);
  }
  if (input.photo) {
    formData.append('photo', input.photo);
  }
  return formData;
}

export function createChild(householdId: string, formData: FormData): Promise<ChildSummary> {
  return apiFetch<ChildSummary>(`/households/${householdId}/children`, {
    method: 'POST',
    body: formData,
  });
}

export function listChildren(householdId: string): Promise<ChildSummary[]> {
  return apiFetch<ChildSummary[]>(`/households/${householdId}/children`);
}

export function fetchChild(householdId: string, childId: string): Promise<ChildSummary> {
  return apiFetch<ChildSummary>(`/households/${householdId}/children/${childId}`);
}

export function updateChild(
  householdId: string,
  childId: string,
  formData: FormData,
): Promise<ChildSummary> {
  return apiFetch<ChildSummary>(`/households/${householdId}/children/${childId}`, {
    method: 'PATCH',
    body: formData,
  });
}

export function deleteChild(householdId: string, childId: string): Promise<void> {
  return apiFetch<void>(`/households/${householdId}/children/${childId}`, {
    method: 'DELETE',
  });
}

/**
 * Plain path builder, NOT routed through `apiFetch` — consumed directly as
 * an `<img src>`, so the browser sends the auth cookies itself on the
 * same-origin request. `cacheBust` is `getPhotoCacheBust(childId)` from
 * `child/childPhotoCacheBust.ts`, appended as a `v` query param since the
 * backend exposes no photo version/`updatedAt` field to key off of.
 */
export function childPhotoUrl(householdId: string, childId: string, cacheBust: number): string {
  return `/api/households/${householdId}/children/${childId}/photo?v=${cacheBust}`;
}
