import {
  LengthMeasurementPosition,
  toLengthMeasurementPosition,
} from './length-measurement-position.enum';

describe('toLengthMeasurementPosition', () => {
  it.each([LengthMeasurementPosition.LYING, LengthMeasurementPosition.STANDING])(
    'passes through a valid position value %s unchanged',
    (position) => {
      expect(toLengthMeasurementPosition(position)).toBe(position);
    },
  );

  it('rejects AUTO, which is modelled as a null column rather than a member', () => {
    expect(() => toLengthMeasurementPosition('AUTO')).toThrow(
      'Invalid LengthMeasurementPosition: AUTO',
    );
  });

  it('throws on an empty string', () => {
    expect(() => toLengthMeasurementPosition('')).toThrow();
  });
});
