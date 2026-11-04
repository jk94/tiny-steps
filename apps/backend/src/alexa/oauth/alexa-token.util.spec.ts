import {
  generateAlexaToken,
  hashAlexaToken,
  PKCE_VERIFIER_PATTERN,
  pkceS256Challenge,
  secretsMatch,
} from './alexa-token.util';

describe('alexa-token.util', () => {
  it('generates prefixed, URL-safe tokens with 256 bits of entropy', () => {
    const token = generateAlexaToken('refresh');
    expect(token).toMatch(/^tsr_[A-Za-z0-9_-]{43}$/);
    expect(generateAlexaToken('refresh')).not.toBe(token);
  });

  it('hashes tokens deterministically', () => {
    expect(hashAlexaToken('abc')).toBe(hashAlexaToken('abc'));
    expect(hashAlexaToken('abc')).not.toBe(hashAlexaToken('abd'));
  });

  describe('secretsMatch', () => {
    const secret = 'e2e-client-secret-0123456789abcdefghij';

    it('accepts the exact secret', () => {
      expect(secretsMatch(secret, secret)).toBe(true);
    });

    it.each([
      ['a different secret of the same length', secret.replace(/j$/, 'k')],
      ['a prefix of the secret', secret.slice(0, -1)],
      ['the secret plus a suffix', `${secret}x`],
      ['an empty string', ''],
    ])('rejects %s', (_label, presented) => {
      expect(secretsMatch(presented, secret)).toBe(false);
    });

    it('compares multi-byte characters by their bytes', () => {
      expect(secretsMatch('geheim-ä', 'geheim-ä')).toBe(true);
      expect(secretsMatch('geheim-a', 'geheim-ä')).toBe(false);
    });
  });

  it('computes the RFC 7636 S256 challenge', () => {
    // Test vector from RFC 7636, appendix B.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(PKCE_VERIFIER_PATTERN.test(verifier)).toBe(true);
    expect(pkceS256Challenge(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});
