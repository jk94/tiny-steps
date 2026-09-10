import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { MEASUREMENT_VALUE_FIELDS } from '../growth-measurement.constants';

/**
 * Rejects a growth measurement that carries none of the three measurement
 * values (W-1). All three are individually optional (W-2), so the rule can
 * only be expressed across the whole object — the constraint therefore reads
 * its siblings off `args.object` rather than looking at the decorated
 * property's own value, mirroring `IsEndNotBeforeStartConstraint` in the
 * feeding module.
 *
 * Attach it to the always-present `measuredAt` field, NOT to one of the value
 * fields: `@IsOptional()` short-circuits every validator on its property when
 * the value is absent, which is exactly the case this constraint has to catch.
 *
 * Only usable for *create*: a PATCH body legitimately omits every value field
 * while changing only the note or the date, so `GrowthService.update()`
 * re-checks the same rule against the merged result instead.
 */
@ValidatorConstraint({ name: 'atLeastOneMeasurementValue', async: false })
export class AtLeastOneMeasurementValueConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as Record<string, unknown>;
    return MEASUREMENT_VALUE_FIELDS.some(
      (field) => dto[field] !== undefined && dto[field] !== null,
    );
  }

  defaultMessage(): string {
    return `at least one of ${MEASUREMENT_VALUE_FIELDS.join(', ')} must be provided`;
  }
}

export function AtLeastOneMeasurementValue(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: AtLeastOneMeasurementValueConstraint,
    });
  };
}
