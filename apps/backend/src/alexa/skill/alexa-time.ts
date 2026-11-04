import type { AlexaLocale } from './alexa-messages';

/**
 * Time-zone arithmetic and spoken time formatting for the skill.
 *
 * Alexa answers have to talk in the *listener's* wall-clock time ("um
 * 14:20 Uhr", "heute"), while everything is stored as UTC instants. The device
 * time zone comes from the Alexa Settings API (see `AlexaApiClient`); this
 * module only does the conversions, with `Intl` and no date library.
 */

export interface ZonedDateTime {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Whether `Intl` knows the zone — guards against a garbled Settings API answer. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    partsFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The server's own zone — the fallback when the device's zone is unknown. */
export function serverTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Wall-clock fields of an instant in a zone. */
export function toZoned(instant: Date, timeZone: string): ZonedDateTime & { second: number } {
  const values: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds (positive east of UTC). */
function offsetAt(instant: Date, timeZone: string): number {
  const zoned = toZoned(instant, timeZone);
  const asUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
  );
  // Drop sub-second precision so the comparison is exact.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant at which the wall clock in `timeZone` shows the given local time.
 * Two passes settle the offset around DST changes; a local time that does not
 * exist (skipped by a spring-forward) resolves to the instant just after the gap.
 */
export function fromZoned(local: ZonedDateTime, timeZone: string): Date {
  const wallAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  let guess = wallAsUtc - offsetAt(new Date(wallAsUtc), timeZone);
  guess = wallAsUtc - offsetAt(new Date(guess), timeZone);
  return new Date(guess);
}

/** Calendar-day arithmetic on wall-clock dates (month/year rollover included). */
export function addDays(
  date: Pick<ZonedDateTime, 'year' | 'month' | 'day'>,
  days: number,
): Pick<ZonedDateTime, 'year' | 'month' | 'day'> {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** `[start, end)` of the local calendar day `date` in `timeZone`, as UTC instants. */
export function zonedDayRange(
  date: Pick<ZonedDateTime, 'year' | 'month' | 'day'>,
  timeZone: string,
): { from: Date; to: Date } {
  const next = addDays(date, 1);
  return {
    from: fromZoned({ ...date, hour: 0, minute: 0 }, timeZone),
    to: fromZoned({ ...next, hour: 0, minute: 0 }, timeZone),
  };
}

/** `YYYY-MM-DD` of a wall-clock date — the format calendar-day columns compare in. */
export function toIsoDate(date: Pick<ZonedDateTime, 'year' | 'month' | 'day'>): string {
  return [
    String(date.year).padStart(4, '0'),
    String(date.month).padStart(2, '0'),
    String(date.day).padStart(2, '0'),
  ].join('-');
}

/** Whole-day difference between two wall-clock dates (`b - a`). */
export function daysBetween(
  a: Pick<ZonedDateTime, 'year' | 'month' | 'day'>,
  b: Pick<ZonedDateTime, 'year' | 'month' | 'day'>,
): number {
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

// -----------------------------------------------------------------------------
// Spoken formatting
// -----------------------------------------------------------------------------

/**
 * Grammatical case a German duration is spoken in. Only days differ between
 * the two ("2 Tage" vs. "vor 2 Tagen"), and "eine/einer Stunde".
 */
export type DurationCase = 'nominative' | 'dative';

interface UnitWords {
  one: Record<DurationCase, string>;
  other: Record<DurationCase, string>;
}

const GERMAN_UNITS: Record<'day' | 'hour' | 'minute', UnitWords> = {
  day: {
    one: { nominative: 'ein Tag', dative: 'einem Tag' },
    other: { nominative: '{n} Tage', dative: '{n} Tagen' },
  },
  hour: {
    one: { nominative: 'eine Stunde', dative: 'einer Stunde' },
    other: { nominative: '{n} Stunden', dative: '{n} Stunden' },
  },
  minute: {
    one: { nominative: 'eine Minute', dative: 'einer Minute' },
    other: { nominative: '{n} Minuten', dative: '{n} Minuten' },
  },
};

const ENGLISH_UNITS: Record<'day' | 'hour' | 'minute', { one: string; other: string }> = {
  day: { one: 'one day', other: '{n} days' },
  hour: { one: 'one hour', other: '{n} hours' },
  minute: { one: 'one minute', other: '{n} minutes' },
};

const MINUTE_MS = 60 * 1000;

/**
 * A duration as spoken text with at most two units, rounded to whole minutes:
 * "2 Stunden und 5 Minuten", "ein Tag und 3 Stunden", "45 minutes".
 * Returns `null` below one minute so callers can pick their own wording
 * ("gerade eben", "weniger als eine Minute").
 */
export function formatDuration(
  ms: number,
  locale: AlexaLocale,
  grammaticalCase: DurationCase = 'nominative',
): string | null {
  const totalMinutes = Math.round(Math.max(0, ms) / MINUTE_MS);
  if (totalMinutes < 1) {
    return null;
  }

  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts: Array<['day' | 'hour' | 'minute', number]> = [];
  if (days > 0) parts.push(['day', days]);
  if (hours > 0) parts.push(['hour', hours]);
  // Minutes only matter while the duration is under a day.
  if (minutes > 0 && days === 0) parts.push(['minute', minutes]);

  const words = parts.slice(0, 2).map(([unit, n]) => {
    if (locale === 'de') {
      const forms = GERMAN_UNITS[unit];
      return (n === 1 ? forms.one : forms.other)[grammaticalCase].replace('{n}', String(n));
    }
    const forms = ENGLISH_UNITS[unit];
    return (n === 1 ? forms.one : forms.other).replace('{n}', String(n));
  });

  return words.join(locale === 'de' ? ' und ' : ' and ');
}

/** "14:20" (de) or "2:20 PM" (en) — the clock part of a spoken time. */
export function formatClock(instant: Date, timeZone: string, locale: AlexaLocale): string {
  return normalizeSpaces(
    new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(instant),
  );
}

/** Formats a wall-clock hour/minute without an instant ("8:05", "8:05 AM"). */
export function formatLocalClock(hour: number, minute: number, locale: AlexaLocale): string {
  return formatClock(new Date(Date.UTC(2000, 0, 1, hour, minute)), 'UTC', locale);
}

/** "30. Oktober" (de) or "October 30" (en). */
export function formatDayMonth(
  date: Pick<ZonedDateTime, 'year' | 'month' | 'day'>,
  locale: AlexaLocale,
): string {
  return normalizeSpaces(
    new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-US', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
    }).format(new Date(Date.UTC(date.year, date.month - 1, date.day, 12))),
  );
}

/** Newer ICU versions put narrow no-break spaces into "2:20 PM"; speech wants plain ones. */
function normalizeSpaces(text: string): string {
  return text.replace(/[\u00a0\u202f]/g, ' ');
}
