import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/** Matches a bare calendar day (`2026-09-02`), with no time or zone. */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Requires a value to be a bare calendar day rather than a full instant.
 *
 * Used for `GrowthMeasurement.measuredAt`, which is a *date* (W-1: "no forced
 * time-of-day"), not a moment. Accepting an instant there would reintroduce
 * exactly the timezone bug this rules out: a client turning the picked day
 * into a local time-of-day can land on the previous or next UTC day, so the
 * stored measurement would drift by a day depending on where it was entered.
 *
 * Pairs with `@IsISO8601({ strict: true })` (which also accepts full
 * timestamps) to narrow the accepted shape down to `YYYY-MM-DD`.
 */
@ValidatorConstraint({ name: 'isDateOnly', async: false })
export class IsDateOnlyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && DATE_ONLY_PATTERN.test(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a calendar date in YYYY-MM-DD form`;
  }
}

export function IsDateOnly(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsDateOnlyConstraint,
    });
  };
}
