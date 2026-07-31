import { TransformFnParams } from 'class-transformer';

/**
 * `class-transformer` `@Transform()` callback that trims and lowercases an
 * email value before `@IsEmail()` validates it and before it's used for
 * storage/lookup — so e.g. `Foo@x.de` and `foo@x.de` are treated as the
 * same account. Runs before validation because `main.ts` configures the
 * global `ValidationPipe` with `transform: true`.
 */
export function normalizeEmail({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
