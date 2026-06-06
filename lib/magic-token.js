/**
 * lib/magic-token.js
 * ==================
 * Self-contained magic link token generation and verification.
 * Uses Node's built-in `crypto` module — no extra packages required.
 *
 * Token format:  base64url(JSON payload) . HMAC-SHA256(payload)
 * Payload:       { email: string, exp: unix_ms }
 * Expiry:        15 minutes
 * Secret:        NEXTAUTH_SECRET (same secret used by NextAuth)
 *
 * Security properties:
 *   - Tamper-proof: any change to payload invalidates the signature
 *   - Time-limited: server rejects tokens after 15 minutes
 *   - Single-use: not enforced server-side (acceptable for 15-min window)
 */

import crypto from 'crypto';

const EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a signed magic-link token for the given email address.
 * @param {string} email - The user's email address (will be lowercased)
 * @returns {string} A URL-safe token string
 */
export function generateMagicToken(email) {
  const payload = JSON.stringify({
    email: email.trim().toLowerCase(),
    exp:   Date.now() + EXPIRY_MS,
  });
  const b64 = Buffer.from(payload).toString('base64url');
  const sig  = crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET)
    .update(b64)
    .digest('base64url');
  return `${b64}.${sig}`;
}

/**
 * Verify a magic-link token.
 * @param {string} token - The token string from the URL
 * @returns {{ email: string, exp: number } | null} Payload if valid, null if invalid/expired
 */
export function verifyMagicToken(token) {
  if (!token || typeof token !== 'string') return null;

  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const b64 = token.slice(0, dotIndex);
  const sig  = token.slice(dotIndex + 1);

  // Constant-time comparison to prevent timing attacks
  const expectedSig = crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET)
    .update(b64)
    .digest('base64url');

  const sigBuffer      = Buffer.from(sig,         'base64url');
  const expectedBuffer = Buffer.from(expectedSig, 'base64url');

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!payload?.email || !payload?.exp) return null;
  if (payload.exp < Date.now()) return null; // expired

  return payload;
}
