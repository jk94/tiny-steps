import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, CsrfGuard } from './csrf.guard';

describe('CsrfGuard', () => {
  const buildContext = (
    cookies: Record<string, string>,
    headers: Record<string, string>,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ cookies, headers }),
      }),
    }) as unknown as ExecutionContext;

  const guard = new CsrfGuard();

  it('allows the request when the header matches the cookie', () => {
    const context = buildContext(
      { [CSRF_COOKIE_NAME]: 'token-123' },
      { [CSRF_HEADER_NAME]: 'token-123' },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects when the header is missing', () => {
    const context = buildContext({ [CSRF_COOKIE_NAME]: 'token-123' }, {});

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects when the cookie is missing', () => {
    const context = buildContext({}, { [CSRF_HEADER_NAME]: 'token-123' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects when the header does not match the cookie', () => {
    const context = buildContext(
      { [CSRF_COOKIE_NAME]: 'token-123' },
      { [CSRF_HEADER_NAME]: 'token-456' },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
