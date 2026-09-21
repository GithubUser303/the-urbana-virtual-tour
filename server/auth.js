import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode';
import { generateTOTPSecret, verifyTOTP, generateOtpAuthUri } from './totp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent secret & state file paths
const DEFAULT_SEED_SECRET = 'LC2O7SW4KOULE42CL5NWAIYVEZTU5BSG';

// Safe filesystem helpers (supports read-only serverless Lambda and local environments)
function getTmpDir() {
  return process.env.TMPDIR || process.env.TEMP || '/tmp';
}

function safeRead(filename) {
  // Try local server directory first
  try {
    const localPath = path.resolve(__dirname, filename);
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8').trim();
      if (content) return content;
    }
  } catch {}

  // Fallback to /tmp (serverless)
  try {
    const tmpPath = path.resolve(getTmpDir(), filename);
    if (fs.existsSync(tmpPath)) {
      const content = fs.readFileSync(tmpPath, 'utf-8').trim();
      if (content) return content;
    }
  } catch {}

  return null;
}

function safeWrite(filename, content) {
  // Attempt local server write
  try {
    const localPath = path.resolve(__dirname, filename);
    fs.writeFileSync(localPath, content, { mode: 0o600 });
    return true;
  } catch {
    // Read-only environment, fallback to /tmp
    try {
      const tmpPath = path.resolve(getTmpDir(), filename);
      fs.writeFileSync(tmpPath, content, { mode: 0o600 });
      return true;
    } catch (e) {
      console.warn(`[auth] safeWrite failed for ${filename}:`, e.message);
      return false;
    }
  }
}

function safeUnlink(filename) {
  try {
    const localPath = path.resolve(__dirname, filename);
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  } catch {}
  try {
    const tmpPath = path.resolve(getTmpDir(), filename);
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  } catch {}
}

// In-memory runtime state for fast resolution and serverless continuity
let inMemoryActiveSecret = null;
let inMemoryEnrolled = false;
let pendingSecret = null;

/**
 * Retrieve or create persistent admin password/key.
 */
export function getOrCreateAdminKey() {
  if (process.env.URBANA_ADMIN_KEY) {
    return process.env.URBANA_ADMIN_KEY.trim();
  }

  const saved = safeRead('.admin_key');
  if (saved) return saved;

  // Default initial admin key (can be customized via env or file)
  const defaultKey = 'urbana_admin_pass';
  safeWrite('.admin_key', defaultKey);
  return defaultKey;
}

export function verifyAdminPassword(password) {
  if (!password || typeof password !== 'string') return false;
  const adminKey = getOrCreateAdminKey();
  try {
    return crypto.timingSafeEqual(
      Buffer.from(password.trim()),
      Buffer.from(adminKey)
    );
  } catch {
    return false;
  }
}

/**
 * Check if TOTP setup has been completed and verified.
 */
export function isTOTPEnrolled() {
  if (process.env.URBANA_TOTP_SECRET) return true;
  if (inMemoryEnrolled && inMemoryActiveSecret) return true;

  const secret = safeRead('.totp_secret');
  const enrolled = safeRead('.totp_enrolled');
  if (secret && enrolled) return true;

  // Seed secret default is active
  if (DEFAULT_SEED_SECRET) return true;

  return false;
}

/**
 * Retrieve current active TOTP secret (only if already enrolled).
 */
export function getActiveTOTPSecret() {
  if (process.env.URBANA_TOTP_SECRET) {
    return process.env.URBANA_TOTP_SECRET.trim().toUpperCase();
  }

  if (inMemoryActiveSecret) {
    return inMemoryActiveSecret.toUpperCase();
  }

  const saved = safeRead('.totp_secret');
  if (saved) return saved.toUpperCase();

  // Seed default secret
  if (DEFAULT_SEED_SECRET) return DEFAULT_SEED_SECRET.toUpperCase();

  return null;
}

/**
 * Start or retrieve pending enrollment details for the administrator.
 */
export async function getEnrollmentSetup(forceReset = false) {
  if (forceReset || !pendingSecret) {
    pendingSecret = generateTOTPSecret();
  }

  const uri = generateOtpAuthUri('Resident', 'The Urbana', pendingSecret);
  const qrCodeDataUrl = await qrcode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    width: 280,
    margin: 2,
    color: {
      dark: '#0e141e',
      light: '#ffffff'
    }
  });

  return {
    secret: pendingSecret,
    uri,
    qrCodeDataUrl,
    isAlreadyActive: isTOTPEnrolled()
  };
}

/**
 * Confirm administrator enrollment with a valid 6-digit TOTP code.
 */
export function confirmEnrollment(code) {
  if (!pendingSecret) {
    return {
      success: false,
      error: 'No enrollment session is currently pending. Please start setup again.'
    };
  }

  const isValid = verifyTOTP(code, pendingSecret, 1);
  if (!isValid) {
    return {
      success: false,
      error: 'Verification code incorrect. Please verify the 6-digit code from your authenticator app.'
    };
  }

  // Update in-memory and write to storage
  inMemoryActiveSecret = pendingSecret;
  inMemoryEnrolled = true;
  safeWrite('.totp_secret', pendingSecret);
  safeWrite('.totp_enrolled', new Date().toISOString());
  pendingSecret = null;

  return { success: true };
}

/**
 * Reset enrollment (removes active flag and prepares fresh secret).
 */
export async function resetEnrollment() {
  inMemoryEnrolled = false;
  inMemoryActiveSecret = null;
  safeUnlink('.totp_enrolled');
  return await getEnrollmentSetup(true);
}

/**
 * Retrieve or generate session signing key.
 * Deterministic default ensures serverless lambdas sign and verify tokens consistently.
 */
function getSessionSigningKey() {
  if (process.env.URBANA_SESSION_SECRET) {
    return process.env.URBANA_SESSION_SECRET.trim();
  }

  const saved = safeRead('.session_secret');
  if (saved) return saved;

  const defaultKey = 'urbana_production_session_secure_key_default_8f3d92';
  safeWrite('.session_secret', defaultKey);
  return defaultKey;
}

const SESSION_SIGNING_KEY = getSessionSigningKey();

// Configurable Server-Side Session Lifetime (Default: 4 hours)
export const SESSION_MAX_AGE_HOURS = parseInt(process.env.SESSION_MAX_AGE_HOURS || '4', 10);
// Optional Inactivity Timeout (structure prepared for future idle timeout policy)
export const SESSION_IDLE_TIMEOUT_HOURS = process.env.SESSION_IDLE_TIMEOUT_HOURS
  ? parseFloat(process.env.SESSION_IDLE_TIMEOUT_HOURS)
  : null;

export const SESSION_DURATION_MS = SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;
export const ADMIN_SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

// Rate-limiting map: ip -> { failedCount, lockUntil, windowStart }
const rateLimitMap = new Map();

export function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record) return { allowed: true };

  if (record.lockUntil && now < record.lockUntil) {
    const remainingSec = Math.ceil((record.lockUntil - now) / 1000);
    return {
      allowed: false,
      message: `Too many failed attempts. Please try again in ${remainingSec} seconds.`
    };
  }

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
 * Issue signed visitor session cookie token with server-side expiration.
 */
export function createSessionToken() {
  const now = Date.now();
  const payload = {
    iat: now,
    exp: now + SESSION_DURATION_MS,
    nonce: crypto.randomBytes(16).toString('hex')
  };

  if (SESSION_IDLE_TIMEOUT_HOURS) {
    payload.idleExp = now + Math.round(SESSION_IDLE_TIMEOUT_HOURS * 60 * 60 * 1000);
  }

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payloadStr)
    .digest('base64url');

  return `${payloadStr}.${signature}`;
}

/**
 * Issue signed admin session cookie token.
 */
export function createAdminToken() {
  const now = Date.now();
  const payload = {
    role: 'admin',
    iat: now,
    exp: now + ADMIN_SESSION_DURATION_MS,
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
 * Inspect a signed token to determine validity and expiration status.
 */
export function inspectSessionToken(token, requiredRole = null) {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };

  const [payloadStr, signature] = parts;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payloadStr)
    .digest('base64url');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return { valid: false, reason: 'signature_mismatch' };
    }
  } catch {
    return { valid: false, reason: 'signature_error' };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
    if (!payload.exp || typeof payload.exp !== 'number') {
      return { valid: false, reason: 'no_exp' };
    }
    if (Date.now() > payload.exp) {
      return { valid: false, expired: true, reason: 'expired' };
    }
    if (requiredRole && payload.role !== requiredRole) {
      return { valid: false, reason: 'role_mismatch' };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'json_error' };
  }
}

/**
 * Verify a signed token (visitor or admin).
 */
export function verifySessionToken(token, requiredRole = null) {
  return inspectSessionToken(token, requiredRole).valid;
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
 * Verify incoming client code against active server TOTP secret.
 */
export function handleVerifyCode(code, clientIp) {
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return { success: false, error: rateLimit.message };
  }

  const secret = getActiveTOTPSecret();
  if (!secret) {
    return {
      success: false,
      error: 'Virtual tour authentication is not yet configured. Please contact the administrator.'
    };
  }

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
 * Check if request has an active valid visitor session.
 */
export function isAuthenticatedRequest(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  const token = cookies['urbana_session'];
  return verifySessionToken(token);
}

export function inspectVisitorSession(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  const token = cookies['urbana_session'];
  return inspectSessionToken(token);
}

/**
 * Check if request has an active valid admin session.
 */
export function isAdminRequest(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  const token = cookies['urbana_admin_session'];
  return verifySessionToken(token, 'admin');
}

export function inspectAdminSession(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  const token = cookies['urbana_admin_session'];
  return inspectSessionToken(token, 'admin');
}
