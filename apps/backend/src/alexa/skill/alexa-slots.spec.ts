import type { AlexaIntent } from './alexa-request.types';
import {
  parseDateSlot,
  parseDurationSlot,
  parseNumberSlot,
  parseTimeSlot,
  resolvedSlotId,
  resolvedSlotName,
  slotValue,
} from './alexa-slots';

const MINUTE = 60 * 1000;

function intentWith(slots: AlexaIntent['slots']): AlexaIntent {
  return { name: 'TestIntent', slots };
}

describe('slot helpers', () => {
  it('reads raw values and treats "?" and blanks as empty', () => {
    const intent = intentWith({
      a: { name: 'a', value: ' Emma ' },
      b: { name: 'b', value: '?' },
      c: { name: 'c' },
    });
    expect(slotValue(intent, 'a')).toBe('Emma');
    expect(slotValue(intent, 'b')).toBeUndefined();
    expect(slotValue(intent, 'c')).toBeUndefined();
    expect(slotValue(intent, 'missing')).toBeUndefined();
  });

  it('returns the resolved ID only for a successful match among the allowed IDs', () => {
    const intent = intentWith({
      diaperType: {
        name: 'diaperType',
        value: 'Kacka',
        resolutions: {
          resolutionsPerAuthority: [
            { authority: 'x', status: { code: 'ER_SUCCESS_NO_MATCH' } },
            {
              authority: 'y',
              status: { code: 'ER_SUCCESS_MATCH' },
              values: [{ value: { name: 'voll', id: 'STOOL' } }],
            },
          ],
        },
      },
    });
    expect(resolvedSlotId(intent, 'diaperType', ['PEE', 'STOOL', 'BOTH'])).toBe('STOOL');
    expect(resolvedSlotId(intent, 'diaperType', ['PEE'])).toBeUndefined();
    expect(resolvedSlotName(intent, 'diaperType')).toBe('voll');
  });

  it('falls back to the spoken value when nothing resolved', () => {
    const intent = intentWith({ medication: { name: 'medication', value: 'Globuli' } });
    expect(resolvedSlotId(intent, 'medication', ['VITAMIN_D'])).toBeUndefined();
    expect(resolvedSlotName(intent, 'medication')).toBe('Globuli');
  });
});

describe('parseNumberSlot', () => {
  it.each([
    ['120', 120],
    ['0', 0],
    ['-5', null],
    ['12.5', null],
    ['zwölf', null],
    [undefined, null],
  ])('%s → %s', (value, expected) => {
    expect(parseNumberSlot(value)).toBe(expected);
  });
});

describe('parseDurationSlot', () => {
  it.each([
    ['PT15M', 15 * MINUTE],
    ['PT2H30M', 150 * MINUTE],
    ['PT1.5H', 90 * MINUTE],
    ['P1D', 24 * 60 * MINUTE],
    ['PT90S', 1.5 * MINUTE],
    ['P1W', null],
    ['P2M', null],
    ['PT', null],
    ['P', null],
    ['PT0M', null],
    ['zwei Stunden', null],
    [undefined, null],
  ])('%s → %s', (value, expected) => {
    expect(parseDurationSlot(value)).toBe(expected);
  });
});

describe('parseTimeSlot', () => {
  it.each([
    ['20:00', { hour: 20, minute: 0 }],
    ['08:15', { hour: 8, minute: 15 }],
    ['7:05', { hour: 7, minute: 5 }],
    ['EV', null],
    ['MO', null],
    ['25:00', null],
    [undefined, null],
  ])('%s → %j', (value, expected) => {
    expect(parseTimeSlot(value)).toEqual(expected);
  });
});

describe('parseDateSlot', () => {
  it.each([
    ['2026-10-31', { year: 2026, month: 10, day: 31 }],
    ['2026-02-30', null],
    ['2026-W44', null],
    ['2026-10', null],
    ['PRESENT_REF', null],
  ])('%s → %j', (value, expected) => {
    expect(parseDateSlot(value)).toEqual(expected);
  });
});
