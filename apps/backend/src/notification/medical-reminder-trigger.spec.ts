import { resolveMedicalReminderTrigger } from './medical-reminder-trigger';

// `dueAt` fixtures are UTC-midnight instants, exactly as Prisma hands back a
// stored calendar day — local-component dates would hide the very off-by-one
// this rule has to get right (see the module doc comment). `now` fixtures are
// real instants at 08:00 UTC, the hour the cron runs.
const DUE_AT = new Date('2026-03-20T00:00:00.000Z'); // Fri, 20 Mar 2026
const at = (day: number, hour = 8) => new Date(Date.UTC(2026, 2, day, hour, 0, 0));

const LEAD_DAYS = 3; // lead instant = 17 Mar 2026, 00:00 UTC

function trigger(overrides: {
  now: Date;
  reminderLastSentAt?: Date | null;
  leadDays?: number;
  enabled?: boolean;
  dueAt?: Date;
}) {
  return resolveMedicalReminderTrigger({
    now: overrides.now,
    dueAt: overrides.dueAt ?? DUE_AT,
    reminderLastSentAt: overrides.reminderLastSentAt ?? null,
    leadDays: overrides.leadDays ?? LEAD_DAYS,
    enabled: overrides.enabled ?? true,
  });
}

describe('resolveMedicalReminderTrigger', () => {
  it('never fires for a member who switched reminders off (MED-8)', () => {
    for (const day of [16, 17, 19, 20, 21]) {
      expect(trigger({ now: at(day), enabled: false })).toBeNull();
    }
  });

  it('stays silent before the lead window opens', () => {
    expect(trigger({ now: at(16, 23) })).toBeNull();
  });

  it('fires LEAD on the first day of the lead window', () => {
    expect(trigger({ now: at(17, 0) })).toBe('LEAD');
    expect(trigger({ now: at(17, 23) })).toBe('LEAD');
  });

  it('fires LEAD again on a later lead-window day if nothing was sent yet', () => {
    // The daily cron could have been down on day D-3; the reminder is still due.
    expect(trigger({ now: at(18) })).toBe('LEAD');
  });

  it('still calls the day before the due day LEAD, not DUE', () => {
    // The off-by-one regression: `dueAt` is a calendar day stored as UTC
    // midnight, so reading it through local getters turns it into D-1 on every
    // server west of UTC — which would fire DUE here and then swallow it on the
    // real due day, since the shared stamp has already passed the due instant.
    expect(trigger({ now: at(19) })).toBe('LEAD');
    expect(trigger({ now: at(19, 23) })).toBe('LEAD');
  });

  it('suppresses LEAD once the shared stamp reached the lead instant (MED-9)', () => {
    expect(trigger({ now: at(18), reminderLastSentAt: at(17, 8) })).toBeNull();
    expect(trigger({ now: at(19), reminderLastSentAt: at(17, 8) })).toBeNull();
  });

  it('fires DUE on the due day even though a LEAD already went out', () => {
    // The lead-window send necessarily predates the due instant, which is what
    // lets one shared column carry both triggers.
    expect(trigger({ now: at(20), reminderLastSentAt: at(17, 8) })).toBe('DUE');
  });

  it('suppresses DUE once the shared stamp reached the due instant', () => {
    expect(trigger({ now: at(20, 20), reminderLastSentAt: at(20, 8) })).toBeNull();
    expect(trigger({ now: at(21), reminderLastSentAt: at(20, 8) })).toBeNull();
  });

  it('keeps nudging an overdue record until it has been reminded about once', () => {
    expect(trigger({ now: at(22) })).toBe('DUE');
    expect(trigger({ now: at(22), reminderLastSentAt: at(21, 8) })).toBeNull();
  });

  it('goes straight to DUE for an entry created when it was already overdue', () => {
    // No LEAD for a window that closed before the record existed.
    expect(trigger({ now: at(25) })).toBe('DUE');
  });

  describe('per-member lead times', () => {
    it('fires for the 7-day member on D-7 while the 3-day member stays silent', () => {
      expect(trigger({ now: at(13), leadDays: 7 })).toBe('LEAD');
      expect(trigger({ now: at(13), leadDays: 3 })).toBeNull();
    });

    it('fires for the 3-day member on D-3 even though the 7-day member already stamped it', () => {
      // The 7-day member's send landed on D-7, which is still before the 3-day
      // member's own lead instant — so it does not suppress their reminder.
      expect(trigger({ now: at(17), leadDays: 3, reminderLastSentAt: at(13, 8) })).toBe('LEAD');
    });
  });

  it('costs a late-enabling member their LEAD but never their DUE', () => {
    // Another member's LEAD stamped the column on D-3; this member turns their
    // reminders on afterwards, on D-2.
    const stamped = at(17, 8);
    expect(trigger({ now: at(18), reminderLastSentAt: stamped })).toBeNull();
    expect(trigger({ now: at(20), reminderLastSentAt: stamped })).toBe('DUE');
  });

  it('fires LEAD again for a due date moved further out past the old stamp', () => {
    // The service clears `reminderLastSentAt` on a due-date change, but even a
    // surviving stamp predates the new, later lead instant.
    const movedDue = new Date('2026-04-20T00:00:00.000Z'); // lead instant 17 Apr
    expect(trigger({ now: at(17), dueAt: movedDue, reminderLastSentAt: at(13, 8) })).toBeNull();
    expect(
      resolveMedicalReminderTrigger({
        now: new Date(Date.UTC(2026, 3, 17, 8)),
        dueAt: movedDue,
        reminderLastSentAt: at(13, 8),
        leadDays: LEAD_DAYS,
        enabled: true,
      }),
    ).toBe('LEAD');
  });
});
