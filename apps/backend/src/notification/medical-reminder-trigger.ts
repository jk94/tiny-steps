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
 * There are two trigger instants per record, both at UTC midnight:
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

  const today = startOfUtcDay(now).getTime();
  const dueInstant = startOfUtcDay(dueAt).getTime();
  const leadInstant = startOfUtcDay(addDays(dueAt, -leadDays)).getTime();
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
 * Start of `date`'s UTC day.
 *
 * UTC and not the server's local timezone, because `dueAt` is a *calendar day*
 * stored as UTC midnight (like `Child.birthDate`). Reading it back through the
 * local getters would land on the previous day on every server west of UTC —
 * a plain off-by-one that would fire the due-day push a day early and then
 * suppress it on the real due day, regardless of where the user is. See
 * `parseCalendarDate` in the frontend's `lib/calendarDate.ts` for the same trap
 * on the other side of the wire.
 *
 * `now` is a real instant, so its UTC day is what the record's UTC due day is
 * compared against; the remaining server/user timezone skew is documented in
 * `docs/known-issues.md`.
 */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * `date` shifted by whole days. DST-safe: the shift is applied through the UTC
 * date getters, which have no DST to skip over.
 */
export function addDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}
