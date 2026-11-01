import type { AlexaResponseOverrides } from '../alexa/skill/alexa-messages';

/**
 * The `alexa` section of `config.yml` (Phase 8, ADR-0017). Its mere presence
 * enables the integration.
 *
 * Like OIDC client secrets (ADR-0004), `clientSecret` lives in the git-ignored
 * `config.yml` rather than an env var, so one operator-managed file holds the
 * whole skill setup.
 */
export interface AlexaConfig {
  /**
   * The skill's application ID from the Alexa developer console
   * (`amzn1.ask.skill.…`). Every skill request must carry exactly this ID.
   */
  skillId: string;
  /** The OAuth client ID entered under the skill's "Account Linking" settings. */
  clientId: string;
  /** The OAuth client secret entered there; at least 32 characters. */
  clientSecret: string;
  /**
   * The "Alexa Redirect URLs" listed under "Account Linking"
   * (`https://pitangui.amazon.com/api/skill/link/…` etc.). A `redirect_uri`
   * must match one of them exactly.
   */
  redirectUris: string[];
  /** Per-locale overrides of the skill's spoken responses (ALX-13). */
  responses: AlexaResponseOverrides;
}
