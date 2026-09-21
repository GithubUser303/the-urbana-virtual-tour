import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTOTPSecret, verifyTOTP, generateOtpAuthUri } from './totp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent secret file paths
const SECRET_FILE = path.resolve(__dirname, '.totp_secret');
const SESSION_KEY_FILE = path.resolve(__dirname, '.session_secret');

/**
 * Retrieve or automatically generate the persistent TOTP secret.
 */
export function getOrCreateTOTPSecret() {
  if (process.env.URBANA_TOTP_SECRET) {
    return process.env.URBANA_TOTP_SECRET.trim().toUpperCase();
  }

  if (fs.existsSync(SECRET_FILE)) {
    const saved = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
    if (saved) return saved.toUpperCase();
  }

  // Generate standard 160-bit Base32 secret and save
  const newSecret = generateTOTPSecret();
  fs.writeFileSync(SECRET_FILE, newSecret, { mode: 0o600 });
  return newSecret;
}

/**
 * Retrieve or generate session signing key.
 */
function getSessionSigningKey() {
  if (process.env.URBANA_SESSION_SECRET) {
    return process.env.URBANA_SESSION_SECRET;
  }

  if (fs.existsSync(SESSION_KEY_FILE)) {
    const saved = fs.readFileSync(SESSION_KEY_FILE, 'utf-8').trim();
    if (saved) return saved;
  }

  const newKey = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SESSION_KEY_FILE, newKey, { mode: 0o600 });
  return newKey;
}

const SESSION_SIGNING_KEY = getSessionSigningKey();
export const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

// Rate-limiting map: ip -> { failedCount, lockUntil, windowStart }
const rateLimitMap = new Map();

export function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record) return { allowed: true };

  // If locked out
  if (record.lockUntil && now < record.lockUntil) {
    const remainingSec = Math.ceil((record.lockUntil - now) / 1000);
    return {
      allowed: false,
      message: `Too many failed attempts. Please try again in ${remainingSec} seconds.`
    };
  }

  // Reset window if 5 minutes elapsed
  if (now - record.windowStart > 5 * 60 * 1000) {
    rateLimitMap.delete(ip);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedAttempt(ip) {
  const now = Date.now();
  let record = rateLimitMap.get(ip);

  if (!record || now - record.windowStart > 5 * 60 * 1000) {
    record = { failedCount: 1, lockUntil: 0, windowStart: now };
  } else {
    record.failedCount += 1;
  }

  // If failed 5 times, lock out for 60 seconds (or more for subsequent failures)
  if (record.failedCount >= 5) {
    const lockDuration = Math.min(300, 30 * Math.pow(2, record.failedCount - 5)) * 1000;
    record.lockUntil = now + lockDuration;
  }

  rateLimitMap.set(ip, record);
}

export function recordSuccessfulAttempt(ip) {
  rateLimitMap.delete(ip);
}

/**
 * Issue an HMAC-signed session cookie token.
 */
export function createSessionToken() {
  const payload = {
    exp: Date.now() + SESSION_DURATION_MS,
    nonce: crypto.randomBytes(16).toString('hex')
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payloadStr)
    .digest('base64url');

  return `${payloadStr}.${signature}`;
}

/**
 * Verify a session cookie token.
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadStr, signature] = parts;

  // Verify HMAC signature in constant time
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payloadStr)
    .digest('base64url');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return false;
    }
  } catch {
    return false;
  }

  // Verify expiration
  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
    if (!payload.exp || typeof payload.exp !== 'number') return false;
    if (Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to parse cookie string.
 */
export function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });

  return list;
}

/**
 * Verify incoming client code against server TOTP secret.
 */
export function handleVerifyCode(code, clientIp) {
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return { success: false, error: rateLimit.message };
  }

  const secret = getOrCreateTOTPSecret();
  const isValid = verifyTOTP(code, secret, 1);

  if (!isValid) {
    recordFailedAttempt(clientIp);
    return {
      success: false,
      error: 'Invalid authentication code. Please check your authenticator app.'
    };
  }

  recordSuccessfulAttempt(clientIp);
  const token = createSessionToken();
  return { success: true, token };
}

/**
 * Check if request has an active valid session.
 */
export function isAuthenticatedRequest(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  const token = cookies['urbana_session'];
  return verifySessionToken(token);
}

/**
 * Return TOTP enrollment details for administrator setup.
 */
export function getEnrollmentInfo() {
  const secret = getOrCreateTOTPSecret();
  const uri = generateOtpAuthUri('Resident', 'The Urbana', secret);
  return { secret, uri };
}
