import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Rejects an `endedAt` earlier than the sibling `startedAt` property on the
 * same DTO object (the constraint's single `constraints` entry names that
 * sibling property). Passes when either value is missing/malformed — those
 * cases are already covered by `@IsISO8601()`/`@IsNotFutureDate()` on each
 * field individually, so this constraint only asserts the *ordering*
 * between the two.
 *
 * Only catches the case where both fields are present in the same request
 * body — a PATCH that supplies only one of the two fields can't be checked
 * here at all, since the DTO instance never sees the other (existing,
 * unchanged) value. `FeedingService.update` re-checks the merged
 * start/end pair itself after loading the existing row; see its doc
 * comment.
 */
@ValidatorConstraint({ name: 'isEndNotBeforeStart', async: false })
export class IsEndNotBeforeStartConstraint implements ValidatorConstraintInterface {
  validate(endedAt: unknown, args: ValidationArguments): boolean {
    if (typeof endedAt !== 'string') {
      return true;
    }
    const [startPropertyName] = args.constraints as [string];
    const startedAt = (args.object as Record<string, unknown>)[startPropertyName];
    if (typeof startedAt !== 'string') {
      return true;
    }

    const endDate = new Date(endedAt);
    const startDate = new Date(startedAt);
    if (Number.isNaN(endDate.getTime()) || Number.isNaN(startDate.getTime())) {
      return true;
    }

    return endDate.getTime() >= startDate.getTime();
  }

  defaultMessage(args: ValidationArguments): string {
    const [startPropertyName] = args.constraints as [string];
    return `${args.property} must not be before ${startPropertyName}`;
  }
}

export function IsEndNotBeforeStart(
  startPropertyName: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [startPropertyName],
      validator: IsEndNotBeforeStartConstraint,
    });
  };
}
