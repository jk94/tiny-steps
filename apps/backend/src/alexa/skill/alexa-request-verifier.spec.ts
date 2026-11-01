import { readFileSync } from 'fs';
import { join } from 'path';
import { createSign, X509Certificate } from 'crypto';
import {
  AlexaRequestVerifier,
  AlexaVerificationError,
  normalizeCertChainUrl,
} from './alexa-request-verifier';
import type { AlexaRequestEnvelope } from './alexa-request.types';

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

const ROOT = new X509Certificate(fixture('root.pem'));
const OTHER_ROOT = new X509Certificate(fixture('other-root.pem'));
const CHAIN = fixture('leaf.pem') + fixture('intermediate.pem');
const WRONG_SAN_CHAIN = fixture('wrong-san.pem') + fixture('intermediate.pem');
const LEAF_KEY = fixture('test-only-leaf.key');
const WRONG_SAN_KEY = fixture('test-only-wrong-san.key');

const SKILL_ID = 'amzn1.ask.skill.test-skill';
const CERT_URL = 'https://s3.amazonaws.com/echo.api/echo-api-cert-12.pem';
// After the fixtures' notBefore (they were generated on 2026-11-01), well before 2126.
const NOW = new Date('2030-01-01T12:00:00.000Z');

function envelope(
  overrides: { applicationId?: string; timestamp?: string } = {},
): AlexaRequestEnvelope {
  return {
    version: '1.0',
    context: {
      System: {
        application: { applicationId: overrides.applicationId ?? SKILL_ID },
        user: { userId: 'amzn1.ask.account.test' },
      },
    },
    request: {
      type: 'LaunchRequest',
      requestId: 'req-1',
      timestamp: overrides.timestamp ?? NOW.toISOString(),
      locale: 'de-DE',
    },
  };
}

function sign(body: Buffer, key = LEAF_KEY): string {
  return createSign('sha256').update(body).sign(key, 'base64');
}

function signedRequest(env: AlexaRequestEnvelope, key = LEAF_KEY) {
  const rawBody = Buffer.from(JSON.stringify(env));
  return {
    rawBody,
    headers: { signaturecertchainurl: CERT_URL, 'signature-256': sign(rawBody, key) },
  };
}

function verifierWith(chain = CHAIN, roots = [ROOT]) {
  const fetchCertChain = jest.fn().mockResolvedValue(chain);
  const verifier = new AlexaRequestVerifier(SKILL_ID, {
    trustedRoots: roots,
    fetchCertChain,
    now: () => NOW,
  });
  return { verifier, fetchCertChain };
}

describe('AlexaRequestVerifier', () => {
  it('accepts a correctly signed request for this skill', async () => {
    const { verifier } = verifierWith();
    const env = envelope();
    const { rawBody, headers } = signedRequest(env);

    await expect(verifier.verify(headers, rawBody, env)).resolves.toBeUndefined();
  });

  it('caches the certificate chain per URL', async () => {
    const { verifier, fetchCertChain } = verifierWith();
    const env = envelope();
    const { rawBody, headers } = signedRequest(env);

    await verifier.verify(headers, rawBody, env);
    await verifier.verify(headers, rawBody, env);

    expect(fetchCertChain).toHaveBeenCalledTimes(1);
  });

  it('rejects a body that was altered after signing', async () => {
    const { verifier } = verifierWith();
    const env = envelope();
    const { headers } = signedRequest(env);
    const tampered = Buffer.from(JSON.stringify({ ...env, version: '2.0' }));

    await expect(verifier.verify(headers, tampered, env)).rejects.toThrow(AlexaVerificationError);
  });

  it('rejects a signature made with a different key', async () => {
    const { verifier } = verifierWith();
    const env = envelope();
    const { rawBody, headers } = signedRequest(env, WRONG_SAN_KEY);

    await expect(verifier.verify(headers, rawBody, env)).rejects.toThrow(/Signature/);
  });

  it('rejects a chain whose leaf is not issued for echo-api.amazon.com', async () => {
    const { verifier } = verifierWith(WRONG_SAN_CHAIN);
    const env = envelope();
    const { rawBody, headers } = signedRequest(env, WRONG_SAN_KEY);

    await expect(verifier.verify(headers, rawBody, env)).rejects.toThrow(/echo-api.amazon.com/);
  });

  it('rejects a chain that does not end at a trusted root', async () => {
    const { verifier } = verifierWith(CHAIN, [OTHER_ROOT]);
    const env = envelope();
    const { rawBody, headers } = signedRequest(env);

    await expect(verifier.verify(headers, rawBody, env)).rejects.toThrow(/trusted root/);
  });

  it('rejects a chain with a missing intermediate', async () => {
    const { verifier } = verifierWith(fixture('leaf.pem'));
    const env = envelope();
    const { rawBody, headers } = signedRequest(env);

    await expect(verifier.verify(headers, rawBody, env)).rejects.toThrow(AlexaVerificationError);
  });

  it('rejects missing signature headers', async () => {
    const { verifier } = verifierWith();
    const env = envelope();
    const { rawBody } = signedRequest(env);

    await expect(verifier.verify({}, rawBody, env)).rejects.toThrow(/headers/);
  });

  it('rejects a request for another skill before downloading anything', async () => {
    const { verifier, fetchCertChain } = verifierWith();
    const env = envelope({ applicationId: 'amzn1.ask.skill.someone-else' });
    const { rawBody, headers } = signedRequest(env);

    await expect(verifier.verify(headers, rawBody, env)).rejects.toThrow(/different skill/);
    expect(fetchCertChain).not.toHaveBeenCalled();
  });

  it.each([
    ['151 seconds old', new Date(NOW.getTime() - 151_000).toISOString()],
    ['151 seconds in the future', new Date(NOW.getTime() + 151_000).toISOString()],
    ['not a timestamp', 'yesterday'],
  ])('rejects a timestamp %s', async (_label, timestamp) => {
    const { verifier } = verifierWith();
    const env = envelope({ timestamp });
    const { rawBody, headers } = signedRequest(env);

    await expect(verifier.verify(headers, rawBody, env)).rejects.toThrow(/timestamp/);
  });

  it('accepts a timestamp 150 seconds old', async () => {
    const { verifier } = verifierWith();
    const env = envelope({ timestamp: new Date(NOW.getTime() - 150_000).toISOString() });
    const { rawBody, headers } = signedRequest(env);

    await expect(verifier.verify(headers, rawBody, env)).resolves.toBeUndefined();
  });

  it('rejects a chain that has expired', async () => {
    const verifier = new AlexaRequestVerifier(SKILL_ID, {
      trustedRoots: [ROOT],
      fetchCertChain: jest.fn().mockResolvedValue(CHAIN),
      now: () => new Date('2130-01-01T00:00:00.000Z'),
    });
    const env = envelope({ timestamp: '2130-01-01T00:00:00.000Z' });
    const { rawBody, headers } = signedRequest(env);

    await expect(verifier.verify(headers, rawBody, env)).rejects.toThrow(/not currently valid/);
  });

  it('rejects everything when no skill ID is configured', async () => {
    const verifier = new AlexaRequestVerifier(null, { trustedRoots: [ROOT], now: () => NOW });
    const env = envelope();
    const { rawBody, headers } = signedRequest(env);

    await expect(verifier.verify(headers, rawBody, env)).rejects.toThrow(AlexaVerificationError);
  });
});

describe('normalizeCertChainUrl', () => {
  it.each([
    'https://s3.amazonaws.com/echo.api/echo-api-cert.pem',
    'https://s3.amazonaws.com:443/echo.api/echo-api-cert.pem',
    'https://s3.amazonaws.com/echo.api/../echo.api/echo-api-cert.pem',
    'HTTPS://s3.amazonaws.com/echo.api/echo-api-cert.pem',
    'https://S3.AMAZONAWS.COM/echo.api/echo-api-cert.pem',
  ])('accepts %s', (url) => {
    expect(() => normalizeCertChainUrl(url)).not.toThrow();
  });

  it.each([
    'http://s3.amazonaws.com/echo.api/echo-api-cert.pem',
    'https://notamazon.com/echo.api/echo-api-cert.pem',
    'https://s3.amazonaws.com/EcHo.aPi/echo-api-cert.pem',
    'https://s3.amazonaws.com/invalid.path/echo-api-cert.pem',
    'https://s3.amazonaws.com:563/echo.api/echo-api-cert.pem',
    'https://s3.amazonaws.com/echo.api/../invalid.path/cert.pem',
    'https://user:pass@s3.amazonaws.com/echo.api/cert.pem',
    'not a url',
  ])('rejects %s', (url) => {
    expect(() => normalizeCertChainUrl(url)).toThrow(AlexaVerificationError);
  });
});
