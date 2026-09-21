import crypto from 'node:crypto';

// Standard RFC 4648 Base32 alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decode a Base32 string into a Buffer.
 */
export function base32Decode(base32Str) {
  const sanitized = base32Str.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
  let bits = 0;
  let value = 0;
  const output = [];

  for (let i = 0; i < sanitized.length; i++) {
    const char = sanitized[i];
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) {
      throw new Error(`Invalid Base32 character encountered: ${char}`);
    }

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * Encode a Buffer into a standard Base32 string (RFC 4648).
 */
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Generate a cryptographically random Base32 secret for TOTP setup.
 * Default 20 bytes = 160 bits (recommended by RFC 4226 / 6238).
 */
export function generateTOTPSecret(byteLength = 20) {
  const randomBytes = crypto.randomBytes(byteLength);
  return base32Encode(randomBytes);
}

/**
 * Generate a standard 6-digit TOTP code for a specific timestamp step.
 */
export function generateTOTPCode(secretBase32, timeStep = Math.floor(Date.now() / 1000 / 30)) {
  const key = base32Decode(secretBase32);

  // 8-byte big-endian counter buffer
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(timeStep), 0);

  // HMAC-SHA1
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation (RFC 4226 Section 5.4)
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify a user-provided 6-digit TOTP token against a Base32 secret.
 * Supports +/- window steps (default: 1 step = +/- 30s) to account for slight clock drift.
 * Uses timing-safe string comparison to prevent timing side-channel attacks.
 */
export function verifyTOTP(token, secretBase32, window = 1) {
  if (!token || typeof token !== 'string') return false;
  const cleanToken = token.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return false;

  const currentStep = Math.floor(Date.now() / 1000 / 30);

  for (let offset = -window; offset <= window; offset++) {
    const validCode = generateTOTPCode(secretBase32, currentStep + offset);
    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(validCode))) {
      return true;
    }
  }

  return false;
}

/**
 * Generate standard authenticator provisioning URI compatible with:
 * Google Authenticator, Microsoft Authenticator, Authy, etc.
 */
export function generateOtpAuthUri(accountName, issuer, secretBase32) {
  const encIssuer = encodeURIComponent(issuer);
  const encAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encIssuer}:${encAccount}?secret=${secretBase32}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}

