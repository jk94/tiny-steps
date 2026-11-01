import { verify as verifySignature, X509Certificate } from 'crypto';
import { rootCertificates } from 'tls';
import type { AlexaRequestEnvelope } from './alexa-request.types';

/** Amazon: reject requests whose timestamp is more than 150 s off (replay protection). */
export const ALEXA_TIMESTAMP_TOLERANCE_MS = 150 * 1000;
const SIGNING_CERT_SAN = 'echo-api.amazon.com';
const CERT_FETCH_TIMEOUT_MS = 5000;
const CERT_MAX_BYTES = 64 * 1024;
const CERT_CACHE_MAX_ENTRIES = 20;

/** Thrown for every reason a request is not provably from Alexa; the message is for logs only. */
export class AlexaVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlexaVerificationError';
  }
}

export interface AlexaRequestVerifierOptions {
  /** Trust anchors; defaults to Node's bundled Mozilla CA store. Tests inject their own. */
  trustedRoots?: readonly X509Certificate[];
  /** Downloads a PEM chain; defaults to `fetch`. */
  fetchCertChain?: (url: string) => Promise<string>;
  now?: () => Date;
}

/**
 * Verifies that a skill request really comes from Alexa for *this* skill
 * (ALX-14), following Amazon's "Verify that the request was sent by Alexa"
 * rules for skills hosted outside Lambda:
 *
 * 1. `SignatureCertChainUrl` is `https://s3.amazonaws.com[:443]/echo.api/…`
 *    (checked after URL normalization, so `/echo.api/../` tricks fail);
 * 2. the chain it points to is currently valid, its leaf names
 *    `echo-api.amazon.com`, and it chains up to a trusted root;
 * 3. `Signature-256` (base64 RSA-SHA256) verifies over the *raw* body;
 * 4. the request timestamp is within 150 s;
 * 5. the application ID is the configured skill ID.
 *
 * A plain class built by a factory in `AlexaModule` rather than an
 * `@Injectable()`, so tests can construct it with their own CA and clock.
 */
export class AlexaRequestVerifier {
  private readonly trustedRoots: readonly X509Certificate[];
  private readonly fetchCertChain: (url: string) => Promise<string>;
  private readonly now: () => Date;
  private readonly chainCache = new Map<string, { leaf: X509Certificate; expiresAt: number }>();

  constructor(
    private readonly skillId: string | null,
    options: AlexaRequestVerifierOptions = {},
  ) {
    this.trustedRoots = options.trustedRoots ?? systemRoots();
    this.fetchCertChain = options.fetchCertChain ?? defaultFetchCertChain;
    this.now = options.now ?? (() => new Date());
  }

  async verify(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
    envelope: AlexaRequestEnvelope,
  ): Promise<void> {
    // Cheap checks first, so junk never triggers a certificate download.
    this.verifyApplicationId(envelope);
    this.verifyTimestamp(envelope);

    const certUrl = singleHeader(headers, 'signaturecertchainurl');
    const signature = singleHeader(headers, 'signature-256');
    if (!certUrl || !signature) {
      throw new AlexaVerificationError('Missing signature headers');
    }

    const leaf = await this.signingCertificate(certUrl);
    let valid: boolean;
    try {
      valid = verifySignature('sha256', rawBody, leaf.publicKey, Buffer.from(signature, 'base64'));
    } catch {
      // A malformed signature or key type is just another mismatch.
      valid = false;
    }
    if (!valid) {
      throw new AlexaVerificationError('Signature does not match the request body');
    }
  }

  verifyApplicationId(envelope: AlexaRequestEnvelope): void {
    const applicationId =
      envelope.context?.System?.application?.applicationId ??
      envelope.session?.application?.applicationId;
    if (!this.skillId || applicationId !== this.skillId) {
      throw new AlexaVerificationError('Request is for a different skill');
    }
  }

  verifyTimestamp(envelope: AlexaRequestEnvelope): void {
    const timestamp = Date.parse(envelope.request.timestamp);
    if (
      Number.isNaN(timestamp) ||
      Math.abs(this.now().getTime() - timestamp) > ALEXA_TIMESTAMP_TOLERANCE_MS
    ) {
      throw new AlexaVerificationError('Request timestamp out of tolerance');
    }
  }

  /** The validated leaf certificate for a chain URL, cached until it expires. */
  private async signingCertificate(rawUrl: string): Promise<X509Certificate> {
    const url = normalizeCertChainUrl(rawUrl);
    const now = this.now().getTime();
    const cached = this.chainCache.get(url);
    if (cached && cached.expiresAt > now) {
      return cached.leaf;
    }

    const pem = await this.fetchCertChain(url);
    const leaf = this.validateChain(pem);
    if (this.chainCache.size >= CERT_CACHE_MAX_ENTRIES) {
      this.chainCache.clear();
    }
    this.chainCache.set(url, { leaf, expiresAt: Date.parse(leaf.validTo) });
    return leaf;
  }

  private validateChain(pem: string): X509Certificate {
    const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
    if (!blocks || blocks.length === 0) {
      throw new AlexaVerificationError('Certificate chain is empty');
    }

    let chain: X509Certificate[];
    try {
      chain = blocks.map((block) => new X509Certificate(block));
    } catch {
      throw new AlexaVerificationError('Certificate chain is malformed');
    }

    const now = this.now().getTime();
    for (const cert of chain) {
      if (Date.parse(cert.validFrom) > now || Date.parse(cert.validTo) < now) {
        throw new AlexaVerificationError('Certificate chain is not currently valid');
      }
    }

    const leaf = chain[0];
    const sans = (leaf.subjectAltName ?? '').split(',').map((entry) => entry.trim());
    if (!sans.includes(`DNS:${SIGNING_CERT_SAN}`)) {
      throw new AlexaVerificationError(`Signing certificate is not for ${SIGNING_CERT_SAN}`);
    }

    for (let i = 0; i < chain.length - 1; i++) {
      if (!chain[i].checkIssued(chain[i + 1]) || !chain[i].verify(chain[i + 1].publicKey)) {
        throw new AlexaVerificationError('Certificate chain is broken');
      }
    }

    const top = chain[chain.length - 1];
    const anchored = this.trustedRoots.some(
      (root) =>
        root.fingerprint256 === top.fingerprint256 ||
        (top.checkIssued(root) && top.verify(root.publicKey)),
    );
    if (!anchored) {
      throw new AlexaVerificationError('Certificate chain does not end at a trusted root');
    }

    return leaf;
  }
}

/**
 * Amazon's URL rules, applied to the *normalized* URL: scheme https, host
 * s3.amazonaws.com (case-insensitive), port 443 if any, path under
 * `/echo.api/`. Returns the normalized URL used for fetching and caching.
 */
export function normalizeCertChainUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AlexaVerificationError('Certificate URL is malformed');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 's3.amazonaws.com' ||
    (url.port !== '' && url.port !== '443') ||
    !url.pathname.startsWith('/echo.api/') ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new AlexaVerificationError('Certificate URL is not an Alexa signing URL');
  }
  return url.toString();
}

function singleHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

let cachedSystemRoots: X509Certificate[] | undefined;

function systemRoots(): X509Certificate[] {
  if (!cachedSystemRoots) {
    cachedSystemRoots = rootCertificates.flatMap((pem) => {
      try {
        return [new X509Certificate(pem)];
      } catch {
        return [];
      }
    });
  }
  return cachedSystemRoots;
}

async function defaultFetchCertChain(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(CERT_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AlexaVerificationError(`Certificate download failed: ${String(error)}`);
  }
  if (!response.ok) {
    throw new AlexaVerificationError(`Certificate download failed with HTTP ${response.status}`);
  }
  const text = await response.text();
  if (text.length > CERT_MAX_BYTES) {
    throw new AlexaVerificationError('Certificate chain is too large');
  }
  return text;
}
