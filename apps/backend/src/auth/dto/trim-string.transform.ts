import { TransformFnParams } from 'class-transformer';

/**
 * `class-transformer` `@Transform()` callback that trims surrounding
 * whitespace before validation runs — so a whitespace-only value collapses to
 * `''` and is rejected by `@IsNotEmpty()` instead of being stored as a blank
 * string. Blank names in particular are unrecoverable in the UI: they win over
 * the email fallback (`user.name ?? user.email`) yet render as nothing, and
 * they satisfy the "has a name" check that would otherwise re-prompt for one.
 * Runs before validation because `main.ts` configures the global
 * `ValidationPipe` with `transform: true`.
 */
export function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
