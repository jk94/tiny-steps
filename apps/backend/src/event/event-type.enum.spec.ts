import { EventType, toEventType } from './event-type.enum';

describe('toEventType', () => {
  it.each([EventType.FEEDING])('passes through a valid event type value %s unchanged', (type) => {
    expect(toEventType(type)).toBe(type);
  });

  it('throws on an unexpected string value', () => {
    expect(() => toEventType('SLEEP')).toThrow('Invalid EventType: SLEEP');
  });

  it('throws on an empty string', () => {
    expect(() => toEventType('')).toThrow();
  });
});
