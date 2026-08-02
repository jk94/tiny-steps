import { EventType, toEventType } from './event-type.enum';

describe('toEventType', () => {
  it.each([EventType.FEEDING, EventType.SLEEP, EventType.DIAPER])(
    'passes through a valid event type value %s unchanged',
    (type) => {
      expect(toEventType(type)).toBe(type);
    },
  );

  it('throws on an unexpected string value', () => {
    expect(() => toEventType('BATH')).toThrow('Invalid EventType: BATH');
  });

  it('throws on an empty string', () => {
    expect(() => toEventType('')).toThrow();
  });
});
