import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { LocalAuthEnabledGuard } from './local-auth-enabled.guard';

describe('LocalAuthEnabledGuard', () => {
  const buildContext = (): ExecutionContext => ({}) as unknown as ExecutionContext;

  it('allows the request when auth.local.enabled is true', () => {
    const configService = { get: jest.fn().mockReturnValue(true) } as unknown as ConfigService<
      AppConfig,
      true
    >;
    const guard = new LocalAuthEnabledGuard(configService);

    expect(guard.canActivate(buildContext())).toBe(true);
    expect(configService.get).toHaveBeenCalledWith('auth.local.enabled', { infer: true });
  });

  it('throws NotFoundException when auth.local.enabled is false', () => {
    const configService = { get: jest.fn().mockReturnValue(false) } as unknown as ConfigService<
      AppConfig,
      true
    >;
    const guard = new LocalAuthEnabledGuard(configService);

    expect(() => guard.canActivate(buildContext())).toThrow(NotFoundException);
  });
});
