import {
  HealthRecordKind,
  isHealthRecordKind,
  toHealthRecordKind,
} from './health-record-kind.enum';

describe('toHealthRecordKind', () => {
  it.each(Object.values(HealthRecordKind))('accepts the stored value %s', (kind) => {
    expect(toHealthRecordKind(kind)).toBe(kind);
  });

  // The DB column is a plain String (ADR-0002), so this cast is the only place
  // an unexpected value can be caught — silently returning it would let a typo
  // flow into the per-kind field rules as a third, unhandled kind.
  it.each(['medication', 'VITAMIN', '', 'MEDICATION '])('throws on %p', (value) => {
    expect(() => toHealthRecordKind(value)).toThrow(`Invalid HealthRecordKind: ${value}`);
  });
});

describe('isHealthRecordKind', () => {
  it('narrows a valid value and rejects an unknown one', () => {
    expect(isHealthRecordKind('VACCINATION')).toBe(true);
    expect(isHealthRecordKind('SOMETHING_ELSE')).toBe(false);
  });
});
