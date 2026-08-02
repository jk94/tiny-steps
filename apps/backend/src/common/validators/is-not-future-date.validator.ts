import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Rejects any date later than "now". Shared across `Child.birthDate`,
 * Feeding event timestamps (`occurredAt`/`startedAt`/`endedAt`), and Sleep
 * event timestamps — a future timestamp is operator error in all three
 * cases, since these are logged in real time or backfilled after the fact,
 * never scheduled ahead. Runs after `@IsISO8601()` in the decorator chain,
 * so `value` is expected to already be a well-formed ISO 8601 string by the
 * time this validates.
 *
 * Consolidated here from two near-identical copies
 * (`child/validators/is-not-future-date.validator.ts` and
 * `feeding/validators/is-not-future-date.validator.ts`) once Sleep became
 * the third consumer needing it — see those modules' git history for the
 * original per-module copies.
 */
@ValidatorConstraint({ name: 'isNotFutureDate', async: false })
export class IsNotFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must not be in the future`;
  }
}

export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNotFutureDateConstraint,
    });
  };
}
