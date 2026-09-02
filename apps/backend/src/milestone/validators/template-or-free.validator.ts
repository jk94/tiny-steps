import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Enforces the create-time split between the two kinds of milestone (M-2/M-4):
 * a **template** entry identified by `templateKey`, or a **free** entry
 * without one. Both always carry a `title`, so the rule that actually needs
 * checking across fields is the `category`:
 *
 * - free entry (`templateKey` absent/null) — `category` is the user's own
 *   optional choice and is accepted as sent;
 * - template entry — the category is defined by the catalog and derived
 *   server-side, so a client-supplied one is **rejected** rather than silently
 *   overwritten. Silently discarding it would hide a client bug and let two
 *   sides of the app disagree about what a milestone's category is.
 *
 * Attach it to the always-present `achievedAt` field, NOT to `category`:
 * `@IsOptional()` short-circuits every validator on its property when the
 * value is absent, which is one of the cases this constraint has to see. Same
 * structure as `AtLeastOneMeasurementValueConstraint` in the growth module.
 */
@ValidatorConstraint({ name: 'templateOrFreeEntry', async: false })
export class TemplateOrFreeEntryConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as { templateKey?: string | null; category?: string | null };
    const isTemplateEntry = dto.templateKey !== undefined && dto.templateKey !== null;
    return !isTemplateEntry || dto.category === undefined || dto.category === null;
  }

  defaultMessage(): string {
    return 'category must not be sent for a template milestone — it is derived from the catalog';
  }
}

export function TemplateOrFreeEntry(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: TemplateOrFreeEntryConstraint,
    });
  };
}
