import { ValidateIf, ValidationOptions } from 'class-validator';

/**
 * Marks a PATCH field as optional *without* also accepting an explicit `null`.
 *
 * `@IsOptional()` skips every other validator for `null` as well as for
 * `undefined`, which is exactly right for a field a PATCH may clear — but wrong
 * for a non-nullable column: `{ "name": null }` would sail through validation
 * and only blow up in Prisma, as an uncaught 500 instead of a 400 naming the
 * offending field.
 *
 * This keeps "key absent → leave it alone" while letting the field's own
 * `@IsString()`/`@IsBoolean()`/… reject the `null`.
 */
export function ValidateIfDefined(validationOptions?: ValidationOptions) {
  return ValidateIf((_object, value) => value !== undefined, validationOptions);
}
