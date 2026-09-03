/**
 * The two moments a planned medication/vaccination is reminded about (MED-7):
 * once with the configured lead time, and once on the due day itself.
 *
 * Deliberately more than the roadmap's minimum of "one reminder": a lead-time
 * push alone is easy to swipe away three days early, and a due-day push alone
 * gives no time to make an appointment.
 */
export type MedicalReminderTrigger = 'LEAD' | 'DUE';

export interface MedicalReminderInput {
  now: Date;
  /** The record's due day (stored as UTC midnight). */
  dueAt: Date;
  /** The record's SHARED `reminderLastSentAt`, snapshotted before this run. */
  reminderLastSentAt: Date | null;
  /** THIS household member's `medicalReminderLeadDays`. */
  leadDays: number;
  /** THIS household member's `medicalReminderEnabled`. */
  enabled: boolean;
}

/**
 * Decides which reminder trigger — if any — fires for ONE household member on
 * this cron run.
 *
 * There are two trigger instants per record, both at local midnight:
 *   DUE  instant = start of the due day                        (member-independent)
 *   LEAD instant = start of (due day − this member's leadDays)  (member-specific)
 *
 * De-duplication (MED-9) works off the record's single shared
 * `reminderLastSentAt`: a trigger fires unless that column has already advanced
 * to or past the trigger's own instant. That one column is enough for the two
 * cases that matter:
 * - each member's LEAD instant is their own, so members with different lead
 *   times each still get their advance reminder;
 * - the DUE instant is shared, but any lead-window send necessarily predates
 *   it, so every member still gets the due-day push.
 *
 * The accepted gap: a member who switches their reminders on *late* — after
 * another member's LEAD already stamped the column past their own lead instant
 * — misses the advance reminder for that one record. They still get the due-day
 * push. Fixing this would mean per-(record, member) send state, which the
 * roadmap explicitly rules out ("no second notification mechanism").
 *
 * Pure and clock-free: "now" is passed in, so the whole rule can be tested with
 * a pinned date rather than against the wall clock.
 */
export function resolveMedicalReminderTrigger({
  now,
  dueAt,
  reminderLastSentAt,
  leadDays,
  enabled,
}: MedicalReminderInput): MedicalReminderTrigger | null {
  if (!enabled) {
    return null;
  }

  const today = startOfLocalDay(now).getTime();
  const dueInstant = startOfLocalDay(dueAt).getTime();
  const leadInstant = startOfLocalDay(addDays(dueAt, -leadDays)).getTime();
  const sent = reminderLastSentAt?.getTime() ?? null;

  // On or past the due day. Also covers an entry created when it was already
  // overdue: it goes straight to DUE and never fires a pointless LEAD for a
  // window that has long closed.
  if (today >= dueInstant) {
    return sent === null || sent < dueInstant ? 'DUE' : null;
  }

  if (today >= leadInstant) {
    return sent === null || sent < leadInstant ? 'LEAD' : null;
  }

  return null;
}

/**
 * Start of `date`'s day in the SERVER's local timezone — the same MVP
 * simplification the daily summary already makes (see
 * `NotificationSchedulerService`'s doc comment and `docs/known-issues.md`).
 */
export function startOfLocalDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** `date` shifted by whole days, DST-safe via the local date getters. */
export function addDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}
