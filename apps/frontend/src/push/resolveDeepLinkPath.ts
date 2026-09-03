/**
 * The `data` payload a push carries (see
 * `apps/backend/src/notification/notification-scheduler.service.ts`). Every
 * value is a string — that is an FCM constraint, not a choice — and every field
 * is optional here because this runs on whatever the OS handed us, which may
 * predate the sending server's version.
 */
export interface PushData {
  type?: string;
  householdId?: string;
  childId?: string;
  healthRecordId?: string;
}

/**
 * Turns a tapped notification's payload into an in-app route (MED-11).
 *
 * Pure and router-free, so the whole mapping is testable without mounting
 * anything. Returns `null` for anything it cannot map — an unknown `type`, or a
 * payload missing the ids every route needs — and the caller then simply does
 * not navigate, leaving the user where they were rather than on a 404.
 *
 * `householdId` is required even for the child-level routes because every
 * in-app path is household-scoped; it was added to all three push payloads for
 * exactly this reason.
 */
export function resolveDeepLinkPath(data: PushData): string | null {
  const { type, householdId, childId, healthRecordId } = data;
  if (!householdId || !childId) {
    return null;
  }

  const base = `/households/${householdId}/children/${childId}`;
  switch (type) {
    case 'MEDICAL_REMINDER':
      // Straight to the entry the reminder was about; the overview is the
      // fallback for a payload from a server that did not send the id yet.
      return healthRecordId ? `${base}/health/${healthRecordId}/edit` : `${base}/health`;
    case 'FEEDING_REMINDER':
      return `${base}/feeding`;
    case 'DAILY_SUMMARY':
      return base;
    default:
      return null;
  }
}
