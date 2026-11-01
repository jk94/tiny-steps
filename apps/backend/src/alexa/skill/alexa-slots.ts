import type { AlexaIntent } from './alexa-request.types';

/**
 * Intent and slot names shared by the handlers and the interaction models in
 * `alexa/skill-package/`. `alexa-interaction-model.spec.ts` asserts the two
 * stay in sync, so renaming one side without the other fails the build.
 */
export const ALEXA_INTENTS = {
  logFeeding: 'LogFeedingIntent',
  stopFeeding: 'StopFeedingIntent',
  logDiaper: 'LogDiaperIntent',
  startSleep: 'StartSleepIntent',
  stopSleep: 'StopSleepIntent',
  logSleep: 'LogSleepIntent',
  lastActivity: 'LastActivityIntent',
  dailySummary: 'DailySummaryIntent',
  feedingReminder: 'SetFeedingReminderIntent',
  medicationReminder: 'SetMedicationReminderIntent',
  upcomingHealth: 'UpcomingHealthRecordsIntent',
  setDefaultChild: 'SetDefaultChildIntent',
} as const;

export const ALEXA_BUILT_IN_INTENTS = {
  help: 'AMAZON.HelpIntent',
  stop: 'AMAZON.StopIntent',
  cancel: 'AMAZON.CancelIntent',
  fallback: 'AMAZON.FallbackIntent',
  navigateHome: 'AMAZON.NavigateHomeIntent',
} as const;

export const SLOT = {
  child: 'child',
  feedingType: 'feedingType',
  side: 'side',
  amount: 'amount',
  duration: 'duration',
  diaperType: 'diaperType',
  activity: 'activity',
  date: 'date',
  time: 'time',
  medication: 'medication',
  recurrence: 'recurrence',
} as const;

/**
 * Custom slot types and the value IDs the handlers understand. The IDs equal
 * the app's enum values where one exists (`FeedingType`, `DiaperType`, …), so a
 * resolved slot maps 1:1 onto a DTO field.
 */
export const SLOT_TYPE_IDS = {
  FEEDING_TYPE: ['BREAST', 'BOTTLE', 'SOLID'],
  BREAST_SIDE: ['LEFT', 'RIGHT'],
  DIAPER_TYPE: ['PEE', 'STOOL', 'BOTH'],
  ACTIVITY_TYPE: ['FEEDING', 'DIAPER', 'SLEEP'],
  REMINDER_RECURRENCE: ['DAILY'],
} as const;

/** The raw spoken value of a slot, or `undefined` when empty / not understood ("?"). */
export function slotValue(intent: AlexaIntent, name: string): string | undefined {
  const value = intent.slots?.[name]?.value?.trim();
  return value && value !== '?' ? value : undefined;
}

/**
 * The canonical ID of a custom-slot value that entity resolution matched
 * (`ER_SUCCESS_MATCH`), restricted to the IDs the caller knows about.
 */
export function resolvedSlotId<T extends string>(
  intent: AlexaIntent,
  name: string,
  allowed: readonly T[],
): T | undefined {
  for (const authority of intent.slots?.[name]?.resolutions?.resolutionsPerAuthority ?? []) {
    if (authority.status.code !== 'ER_SUCCESS_MATCH') continue;
    for (const { value } of authority.values ?? []) {
      if ((allowed as readonly string[]).includes(value.id)) {
        return value.id as T;
      }
    }
  }
  return undefined;
}

/** The canonical *name* of a resolved custom-slot value, falling back to what was said. */
export function resolvedSlotName(intent: AlexaIntent, name: string): string | undefined {
  for (const authority of intent.slots?.[name]?.resolutions?.resolutionsPerAuthority ?? []) {
    if (authority.status.code === 'ER_SUCCESS_MATCH' && authority.values?.[0]) {
      return authority.values[0].value.name;
    }
  }
  return slotValue(intent, name);
}

/** `AMAZON.NUMBER`: a non-negative integer, or `null`. */
export function parseNumberSlot(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

const ISO_DURATION =
  /^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/**
 * `AMAZON.DURATION` ("PT2H30M", "PT15M", "P1D") in milliseconds, or `null` for
 * anything else — weeks, months and years are meaningless for a feed or a nap.
 */
export function parseDurationSlot(value: string | undefined): number | null {
  if (!value) return null;
  const match = ISO_DURATION.exec(value);
  if (!match || value === 'P' || value === 'PT') return null;
  const [, days, hours, minutes, seconds] = match.map((part) => (part ? Number(part) : 0));
  const ms = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  return ms > 0 ? Math.round(ms) : null;
}

/**
 * `AMAZON.TIME` ("20:00", "08:15") as hour/minute. The vague values Alexa can
 * also produce ("MO", "AF", "EV", "NI") are rejected so the skill asks for an
 * exact time instead of guessing one.
 */
export function parseTimeSlot(value: string | undefined): { hour: number; minute: number } | null {
  const match = value ? /^(\d{1,2}):(\d{2})$/.exec(value) : null;
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/**
 * `AMAZON.DATE` as a calendar day, or `null`. Only exact days are supported;
 * weeks ("2026-W44"), months and decades are not a "day" to summarize.
 */
export function parseDateSlot(
  value: string | undefined,
): { year: number; month: number; day: number } | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? { year, month, day }
    : null;
}
