/**
 * DI token for the `JwtSecrets` provider (see `auth.module.ts`), which is
 * wired via a `useFactory: resolveJwtSecrets` provider so the app fails to
 * bootstrap if either secret is missing (see `config/jwt.config.ts`).
 */
export const JWT_SECRETS = 'JWT_SECRETS';
