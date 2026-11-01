import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';

/**
 * Hides every Alexa route unless `config.yml` has an `alexa` section
 * (ALX-15). 404 rather than 403, like `LocalAuthEnabledGuard`: an instance
 * without Alexa should not even reveal that the integration exists.
 */
@Injectable()
export class AlexaEnabledGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  canActivate(): boolean {
    if (!this.configService.get('alexa', { infer: true })) {
      throw new NotFoundException();
    }
    return true;
  }
}
