import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';

/**
 * Gates `register`/`login` behind `auth.local.enabled` from `config.yml`.
 * Throws `NotFoundException` (404) rather than `ForbiddenException` (403)
 * when disabled, so a deployment that only offers OIDC doesn't reveal that
 * local auth exists at all. Applied at the method level only — `refresh`,
 * `logout`, and `me` must stay reachable regardless of this flag, since an
 * OIDC-authenticated user still refreshes/logs out through the same tokens.
 */
@Injectable()
export class LocalAuthEnabledGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  canActivate(): boolean {
    const enabled = this.configService.get('auth.local.enabled', { infer: true });
    if (!enabled) {
      throw new NotFoundException();
    }
    return true;
  }
}
