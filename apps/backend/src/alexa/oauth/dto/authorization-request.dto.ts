import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import type { AuthorizationRequestParams } from '../alexa-oauth.service';

const MAX_PARAM_LENGTH = 2048;

/**
 * The OAuth parameters of an authorization request (RFC 6749 section 4.1.1),
 * relayed verbatim by the consent page from the URL Alexa opened. Snake case
 * on purpose: these are protocol parameter names, not app API fields.
 *
 * Only shape is checked here; whether the client and redirect URI are the
 * configured ones is `AlexaOAuthService`'s job.
 */
export class AuthorizationRequestQueryDto {
  @IsString()
  @MaxLength(MAX_PARAM_LENGTH)
  client_id!: string;

  @IsString()
  @MaxLength(MAX_PARAM_LENGTH)
  redirect_uri!: string;

  @IsString()
  @MaxLength(64)
  response_type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_PARAM_LENGTH)
  state?: string;

  /** Accepted and ignored — the link grants one fixed set of voice actions. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PARAM_LENGTH)
  scope?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  code_challenge?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  code_challenge_method?: string;
}

/** The consent decision: the same parameters plus approve/deny and the default child. */
export class AuthorizationDecisionDto extends AuthorizationRequestQueryDto {
  @IsBoolean()
  approve!: boolean;

  /** Optional default child for voice commands that name none (ALX-9). */
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  @MaxLength(64)
  default_child_id?: string | null;
}

export function toAuthorizationRequestParams(
  dto: AuthorizationRequestQueryDto,
): AuthorizationRequestParams {
  return {
    clientId: dto.client_id,
    redirectUri: dto.redirect_uri,
    responseType: dto.response_type,
    state: dto.state,
    codeChallenge: dto.code_challenge,
    codeChallengeMethod: dto.code_challenge_method,
  };
}
