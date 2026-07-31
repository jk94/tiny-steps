import { JwtService } from '@nestjs/jwt';
import { OidcTransaction, OidcTransactionCookieService } from './oidc-transaction-cookie.service';

const JWT_SECRETS = { accessSecret: 'access-secret', refreshSecret: 'refresh-secret' };

describe('OidcTransactionCookieService', () => {
  let jwtService: JwtService;
  let service: OidcTransactionCookieService;

  beforeEach(() => {
    jwtService = new JwtService({});
    service = new OidcTransactionCookieService(jwtService, JWT_SECRETS);
  });

  const buildTxn = (overrides: Partial<OidcTransaction> = {}): OidcTransaction => ({
    providerId: 'keycloak',
    state: 'state-value',
    nonce: 'nonce-value',
    codeVerifier: 'code-verifier-value',
    ...overrides,
  });

  it('round-trips encode -> decode, returning the original payload', async () => {
    const txn = buildTxn();

    const token = await service.encode(txn);
    const decoded = await service.decode(token);

    expect(decoded).toEqual(txn);
  });

  it('returns null for a malformed token', async () => {
    expect(await service.decode('not-a-jwt')).toBeNull();
  });

  it('returns null for a tampered token', async () => {
    const token = await service.encode(buildTxn());
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'b' : 'a');

    expect(await service.decode(tampered)).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const expiredToken = await jwtService.signAsync(
      { ...buildTxn(), purpose: 'oidc-txn' },
      { secret: JWT_SECRETS.accessSecret, expiresIn: '-1s' },
    );

    expect(await service.decode(expiredToken)).toBeNull();
  });

  it('returns null for a token missing the `purpose` claim (not shaped like an oidc_txn token)', async () => {
    const accessLikeToken = await jwtService.signAsync(
      { sub: 'user-1' },
      { secret: JWT_SECRETS.accessSecret, expiresIn: '15m' },
    );

    expect(await service.decode(accessLikeToken)).toBeNull();
  });

  it('returns null for a token with the wrong purpose claim', async () => {
    const wrongPurposeToken = await jwtService.signAsync(
      { ...buildTxn(), purpose: 'something-else' },
      { secret: JWT_SECRETS.accessSecret, expiresIn: '10m' },
    );

    expect(await service.decode(wrongPurposeToken)).toBeNull();
  });

  it('returns null when signed with a different secret', async () => {
    const foreignToken = await jwtService.signAsync(
      { ...buildTxn(), purpose: 'oidc-txn' },
      { secret: 'some-other-secret', expiresIn: '10m' },
    );

    expect(await service.decode(foreignToken)).toBeNull();
  });
});
