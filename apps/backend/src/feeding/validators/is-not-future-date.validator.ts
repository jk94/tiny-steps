import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Rejects any date later than "now". Applied to feeding event timestamps
 * (`occurredAt`/`startedAt`/`endedAt`) — a future timestamp is operator
 * error, since feeding events are logged in real time or backfilled after
 * the fact, never scheduled ahead. Runs after `@IsISO8601()` in the
 * decorator chain, so `value` is expected to already be a well-formed
 * ISO 8601 string by the time this validates.
 *
 * This is a deliberate copy of
 * `apps/backend/src/child/validators/is-not-future-date.validator.ts`,
 * scoped to `feeding` so this diff doesn't touch `child` — consolidate into
 * a shared location only once a third consumer needs it.
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
