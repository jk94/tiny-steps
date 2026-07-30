import { resolveJwtSecrets } from './jwt.config';

describe('resolveJwtSecrets', () => {
  const originalAccessSecret = process.env.JWT_ACCESS_SECRET;
  const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;

  afterEach(() => {
    process.env.JWT_ACCESS_SECRET = originalAccessSecret;
    process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
  });

  it('returns both secrets when set', () => {
    process.env.JWT_ACCESS_SECRET = 'access-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';

    expect(resolveJwtSecrets()).toEqual({
      accessSecret: 'access-secret',
      refreshSecret: 'refresh-secret',
    });
  });

  it('throws when JWT_ACCESS_SECRET is missing', () => {
    delete process.env.JWT_ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';

    expect(() => resolveJwtSecrets()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('throws when JWT_REFRESH_SECRET is missing', () => {
    process.env.JWT_ACCESS_SECRET = 'access-secret';
    delete process.env.JWT_REFRESH_SECRET;

    expect(() => resolveJwtSecrets()).toThrow(/JWT_REFRESH_SECRET/);
  });

  it('throws when JWT_ACCESS_SECRET is an empty string', () => {
    process.env.JWT_ACCESS_SECRET = '';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';

    expect(() => resolveJwtSecrets()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('throws when both secrets are missing', () => {
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    expect(() => resolveJwtSecrets()).toThrow(/JWT_ACCESS_SECRET/);
  });
});
