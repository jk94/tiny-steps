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
    provider: Joi.string().valid('sqlite', 'postgresql', 'mysql').required(),
    url: Joi.string().min(1).required(),
  }).required(),

  auth: Joi.object({
    local: Joi.object({
      enabled: Joi.boolean().required(),
    }).required(),
    oidc: Joi.object({
      providers: Joi.array().default([]),
    }).required(),
  }).required(),
});
