import { ValidationArguments } from 'class-validator';
import { AtLeastOneMeasurementValueConstraint } from './at-least-one-measurement-value.validator';

function args(object: Record<string, unknown>): ValidationArguments {
  return {
    value: object.measuredAt,
    constraints: [],
    targetName: 'CreateGrowthMeasurementDto',
    object,
    property: 'measuredAt',
  };
}

describe('AtLeastOneMeasurementValueConstraint', () => {
  const constraint = new AtLeastOneMeasurementValueConstraint();
  const measuredAt = '2025-04-01T09:00:00.000Z';

  it.each([
    ['weight only', { weightGrams: 6400 }],
    ['length only', { lengthMillimeters: 615 }],
    ['head circumference only', { headCircumferenceMillimeters: 405 }],
    ['all three', { weightGrams: 6400, lengthMillimeters: 615, headCircumferenceMillimeters: 405 }],
  ])('accepts a measurement with %s (W-2)', (_label, values) => {
    const object = { measuredAt, ...values };
    expect(constraint.validate(object.measuredAt, args(object))).toBe(true);
  });

  it('rejects a measurement without any value (W-1)', () => {
    const object = { measuredAt, note: 'U3 check-up' };
    expect(constraint.validate(object.measuredAt, args(object))).toBe(false);
  });

  it('treats an explicit null as no value', () => {
    const object = {
      measuredAt,
      weightGrams: null,
      lengthMillimeters: null,
      headCircumferenceMillimeters: null,
    };
    expect(constraint.validate(object.measuredAt, args(object))).toBe(false);
  });

  it('accepts a zero-ish value, which range validation rejects separately', () => {
    // The constraint only answers "is a value present"; plausibility limits
    // (W-4) are @Min/@Max's job, so the two rules stay independently testable.
    const object = { measuredAt, weightGrams: 0 };
    expect(constraint.validate(object.measuredAt, args(object))).toBe(true);
  });

  it('names all three fields in its error message', () => {
    expect(constraint.defaultMessage()).toContain('weightGrams');
    expect(constraint.defaultMessage()).toContain('lengthMillimeters');
    expect(constraint.defaultMessage()).toContain('headCircumferenceMillimeters');
  });
});
