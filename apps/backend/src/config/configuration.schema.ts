import * as Joi from 'joi';

/**
 * Validates the shape of `config.yml` (see `config.example.yml` at the repo
 * root for the annotated reference). Kept separate from `configuration.ts`
 * so the schema can be unit-tested on its own.
 */
export const configValidationSchema = Joi.object({
  server: Joi.object({
    port: Joi.number().port().required(),
  }).required(),

  database: Joi.object({
    // Sanity-check value only — see the comment on `database.provider` in
    // `config.example.yml` for why this doesn't switch the DB at runtime.
    // Note there is deliberately no `url` field here: the DB connection
    // string is resolved purely from `DATABASE_URL` / a code-level default,
    // see `src/config/database-url.ts`.
    provider: Joi.string().valid('sqlite', 'postgresql', 'mysql').required(),
  }).required(),

  auth: Joi.object({
    local: Joi.object({
      enabled: Joi.boolean().required(),
    }).required(),
    oidc: Joi.object({
      // See `src/config/oidc-provider.config.ts` (`OidcProviderConfig`) and
      // ADR-0004 for the full reasoning, in particular why `clientSecret`
      // lives here rather than in an env var.
      providers: Joi.array()
        .items(
          Joi.object({
            id: Joi.string()
              .pattern(/^[a-z0-9-]+$/)
              .required(),
            displayName: Joi.string().required(),
            issuer: Joi.string()
              .uri({ scheme: ['https', 'http'] })
              .required(),
            clientId: Joi.string().required(),
            clientSecret: Joi.string().required(),
            scopes: Joi.array().items(Joi.string()).default(['openid', 'profile', 'email']),
          }),
        )
        .unique('id')
        .default([]),
    }).required(),
  }).required(),
});
