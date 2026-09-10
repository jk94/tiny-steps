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

/** Matches a bare calendar day (`2026-09-02`), with no time or zone. */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The largest UTC offset in civil use (UTC+14, Kiritimati). A date-only value
 * is a *calendar day in the sender's local zone*, but `new Date('2026-09-02')`
 * parses it as UTC midnight — so for a user far enough east, "today" is
 * already a UTC instant in the future. Allowing this much slack means a
 * date-only value is rejected only once it is in the future *everywhere on
 * Earth*, which is the only interpretation that doesn't reject a legitimate
 * "I measured this today" entry in Auckland or Kiritimati.
 *
 * The cost is at most one day of slack for users west of UTC+14, which the
 * clients' own `max` attribute on the date input already prevents.
 *
 * Exported because the same skew exists wherever a real instant is compared
 * against a column that stores a bare calendar day as UTC midnight — see
 * `HealthRecordService`'s `administeredAt` vs. `Child.birthDate` check.
 */
export const MAX_UTC_OFFSET_MS = 14 * 60 * 60 * 1000;

@ValidatorConstraint({ name: 'isNotFutureDate', async: false })
export class IsNotFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const latestAcceptable = DATE_ONLY_PATTERN.test(value)
      ? Date.now() + MAX_UTC_OFFSET_MS
      : Date.now();
    return date.getTime() <= latestAcceptable;
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
