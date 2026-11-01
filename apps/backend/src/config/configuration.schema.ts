import * as Joi from 'joi';
import {
  ALEXA_LOCALES,
  ALEXA_MESSAGE_KEYS,
  isAlexaMessageKey,
  unknownPlaceholdersInOverride,
  type AlexaLocale,
} from '../alexa/skill/alexa-messages';

/**
 * Per-locale response overrides for the Alexa skill (ALX-13). Keys must be
 * known message keys, and an override may only use placeholders the built-in
 * template provides — otherwise Alexa would read out a literal `{typo}`.
 */
const alexaResponseOverrides = (locale: AlexaLocale) =>
  Joi.object()
    .pattern(Joi.string().valid(...ALEXA_MESSAGE_KEYS), Joi.string().trim().min(1))
    .custom((value: Record<string, string>, helpers) => {
      for (const [key, template] of Object.entries(value)) {
        if (!isAlexaMessageKey(key)) {
          continue;
        }
        const unknown = unknownPlaceholdersInOverride(locale, key, template);
        if (unknown.length > 0) {
          // Passed as template *values*: a literal `{name}` inside the message
          // text would be parsed by Joi as a template reference and vanish.
          return helpers.message(
            { custom: 'alexa.responses.{#locale}.{#key} uses unknown placeholder(s): {#names}' },
            { locale, key, names: unknown.map((name) => `{${name}}`).join(', ') },
          );
        }
      }
      return value;
    });

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

  // Optional push-notification section. When omitted, push is disabled (see
  // AppConfig.push and ADR-0012). `serviceAccountPath` points at a Firebase
  // service-account JSON file.
  push: Joi.object({
    firebase: Joi.object({
      serviceAccountPath: Joi.string().required(),
    }).required(),
  }).optional(),

  // Optional Alexa skill section (Phase 8, ADR-0017). When omitted, the
  // integration is disabled. See `src/config/alexa.config.ts` for the fields.
  alexa: Joi.object({
    skillId: Joi.string()
      .pattern(/^amzn1\.ask\.skill\.[A-Za-z0-9-]+$/)
      .required(),
    clientId: Joi.string().trim().min(1).required(),
    // A shared secret Amazon presents at the token endpoint. Long and random
    // by requirement — it is the only thing standing between a leaked refresh
    // token and a working one (ADR-0017).
    clientSecret: Joi.string().min(32).required(),
    redirectUris: Joi.array()
      .items(Joi.string().uri({ scheme: ['https'] }))
      .min(1)
      .unique()
      .required(),
    responses: Joi.object(
      Object.fromEntries(ALEXA_LOCALES.map((locale) => [locale, alexaResponseOverrides(locale)])),
    ).default({}),
  }).optional(),
});
