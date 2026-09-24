import crypto from 'crypto';

/**
 * Internal token / webhook-secret helpers for the ISP integration surface.
 *
 * These are pure so they are unit-testable without a DB or network. They are the
 * single source of truth for "is this auth material actually configured?" — a
 * missing or placeholder secret must NEVER be treated as configurable; the
 * integration must fail CLOSED with a 503 so an operator knows to provision it.
 */

const PLACEHOLDER_MARKERS = [
  'default_secret',
  'CHANGE_ME',
  'change_me',
  'changeme',
  '<your_api_key>',
  'your_api_key',
  'ai-zasyfake',
  'fake',
  'test_secret',
];

/** Known-insecure secrets that must never be accepted as a real secret. */
function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.toLowerCase();
  if (v.length < 16) return true; // too short to be a real HMAC secret
  return PLACEHOLDER_MARKERS.some((m) => v === m || v.includes(m));
}

/**
 * Resolve a secret for a specific ISP. Returns undefined if it is unset or a
 * placeholder — the caller must fail closed. Env layer passes the raw env map so
 * this stays pure and testable.
 */
export function resolveSecret(
  env: Record<string, string | undefined>,
  ispId: string,
  envPrefix = 'ISP_',
): string | undefined {
  const key = `${envPrefix}${ispId.toUpperCase()}_SECRET`;
  const raw = env[key];
  // Fallback generic key only if the specific one is genuinely missing AND not
  // a placeholder. We never fall back to a hardcoded literal.
  if (isPlaceholder(raw)) {
    const generic = env[`${envPrefix}DEFAULT_SECRET`];
    if (isPlaceholder(generic)) return undefined;
    return generic;
  }
  return raw;
}

/**
 * Constant-time, length-safe HMAC signature check. Returns false rather than
 * throwing when lengths differ (timingSafeEqual throws on length mismatch).
 */
export function verifySignature(
  payload: string,
  signature: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signature);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/** Generate a strong shared secret (for provisioning helper / docs). */
export function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
