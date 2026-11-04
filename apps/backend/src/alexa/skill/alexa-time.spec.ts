import {
  addDays,
  daysBetween,
  formatClock,
  formatDayMonth,
  formatDuration,
  formatLocalClock,
  fromZoned,
  isValidTimeZone,
  toIsoDate,
  toZoned,
  zonedDayRange,
} from './alexa-time';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('time-zone conversion', () => {
  it('reads wall-clock fields in a zone', () => {
    const zoned = toZoned(new Date('2026-07-01T22:30:00Z'), 'Europe/Berlin');
    expect(zoned).toMatchObject({ year: 2026, month: 7, day: 2, hour: 0, minute: 30 });
  });

  it('converts local midnight back to the right instant in summer and winter', () => {
    expect(
      fromZoned(
        { year: 2026, month: 7, day: 2, hour: 0, minute: 0 },
        'Europe/Berlin',
      ).toISOString(),
    ).toBe('2026-07-01T22:00:00.000Z');
    expect(
      fromZoned(
        { year: 2026, month: 12, day: 2, hour: 0, minute: 0 },
        'Europe/Berlin',
      ).toISOString(),
    ).toBe('2026-12-01T23:00:00.000Z');
  });

  it('gives a 23-hour day on the spring-forward date', () => {
    const { from, to } = zonedDayRange({ year: 2026, month: 3, day: 29 }, 'Europe/Berlin');
    expect(from.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(to.getTime() - from.getTime()).toBe(23 * HOUR);
  });

  it('gives a 25-hour day on the fall-back date', () => {
    const { from, to } = zonedDayRange({ year: 2026, month: 10, day: 25 }, 'Europe/Berlin');
    expect(to.getTime() - from.getTime()).toBe(25 * HOUR);
  });

  it('works for zones west of UTC', () => {
    const { from } = zonedDayRange({ year: 2026, month: 11, day: 1 }, 'America/New_York');
    expect(from.toISOString()).toBe('2026-11-01T04:00:00.000Z');
  });

  it('does calendar arithmetic across month and year ends', () => {
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(addDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
    expect(daysBetween({ year: 2026, month: 12, day: 30 }, { year: 2027, month: 1, day: 2 })).toBe(
      3,
    );
    expect(toIsoDate({ year: 2026, month: 3, day: 9 })).toBe('2026-03-09');
  });

  it('validates time-zone names', () => {
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
  });
});

describe('formatDuration', () => {
  it.each([
    [29 * 1000, null],
    [1 * MINUTE, 'eine Minute'],
    [45 * MINUTE, '45 Minuten'],
    [1 * HOUR, 'eine Stunde'],
    [2 * HOUR + 5 * MINUTE, '2 Stunden und 5 Minuten'],
    [1 * DAY + 3 * HOUR + 10 * MINUTE, 'ein Tag und 3 Stunden'],
    [3 * DAY, '3 Tage'],
  ])('German nominative %d ms → %s', (ms, expected) => {
    expect(formatDuration(ms, 'de')).toBe(expected);
  });

  it.each([
    [1 * MINUTE, 'einer Minute'],
    [1 * HOUR + 1 * MINUTE, 'einer Stunde und einer Minute'],
    [3 * DAY, '3 Tagen'],
    [1 * DAY, 'einem Tag'],
  ])('German dative %d ms → %s', (ms, expected) => {
    expect(formatDuration(ms, 'de', 'dative')).toBe(expected);
  });

  it.each([
    [1 * MINUTE, 'one minute'],
    [2 * HOUR + 5 * MINUTE, '2 hours and 5 minutes'],
    [1 * DAY + 1 * HOUR, 'one day and one hour'],
  ])('English %d ms → %s', (ms, expected) => {
    expect(formatDuration(ms, 'en', 'dative')).toBe(expected);
  });

  it('rounds to whole minutes', () => {
    expect(formatDuration(89 * 1000, 'en')).toBe('one minute');
    expect(formatDuration(90 * 1000, 'en')).toBe('2 minutes');
  });
});

describe('clock and date formatting', () => {
  const instant = new Date('2026-11-01T13:05:00Z');

  it('speaks German 24-hour and English 12-hour times in the device zone', () => {
    expect(formatClock(instant, 'Europe/Berlin', 'de')).toBe('14:05');
    expect(formatClock(instant, 'America/New_York', 'en')).toBe('8:05 AM');
  });

  it('never contains non-breaking spaces', () => {
    expect(formatLocalClock(20, 0, 'en')).toBe('8:00 PM');
    expect(formatLocalClock(8, 15, 'de')).toBe('8:15');
  });

  it('formats day and month', () => {
    expect(formatDayMonth({ year: 2026, month: 10, day: 30 }, 'de')).toBe('30. Oktober');
    expect(formatDayMonth({ year: 2026, month: 10, day: 30 }, 'en')).toBe('October 30');
  });
});
