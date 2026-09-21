import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode';
import { generateTOTPSecret, verifyTOTP, generateOtpAuthUri } from './totp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent secret & state file paths
const SECRET_FILE = path.resolve(__dirname, '.totp_secret');
const ENROLLED_FLAG_FILE = path.resolve(__dirname, '.totp_enrolled');
const SESSION_KEY_FILE = path.resolve(__dirname, '.session_secret');
const ADMIN_KEY_FILE = path.resolve(__dirname, '.admin_key');

// In-memory pending secret during active enrollment flow
let pendingSecret = null;

/**
 * Retrieve or create persistent admin password/key.
 */
export function getOrCreateAdminKey() {
  if (process.env.URBANA_ADMIN_KEY) {
    return process.env.URBANA_ADMIN_KEY.trim();
  }

  if (fs.existsSync(ADMIN_KEY_FILE)) {
    const saved = fs.readFileSync(ADMIN_KEY_FILE, 'utf-8').trim();
    if (saved) return saved;
  }

  // Default initial admin key (can be customized via env or file)
  const defaultKey = 'urbana_admin_pass';
  fs.writeFileSync(ADMIN_KEY_FILE, defaultKey, { mode: 0o600 });
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
  return fs.existsSync(SECRET_FILE) && fs.existsSync(ENROLLED_FLAG_FILE);
}

/**
 * Retrieve current active TOTP secret (only if already enrolled).
 */
export function getActiveTOTPSecret() {
  if (process.env.URBANA_TOTP_SECRET) {
    return process.env.URBANA_TOTP_SECRET.trim().toUpperCase();
  }

  if (fs.existsSync(SECRET_FILE)) {
    const saved = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
    if (saved) return saved.toUpperCase();
  }

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

  // Commit secret to persistent file
  fs.writeFileSync(SECRET_FILE, pendingSecret, { mode: 0o600 });
  fs.writeFileSync(ENROLLED_FLAG_FILE, new Date().toISOString(), { mode: 0o600 });
  pendingSecret = null;

  return { success: true };
}

/**
 * Reset enrollment (removes active flag and prepares fresh secret).
 */
export async function resetEnrollment() {
  if (fs.existsSync(ENROLLED_FLAG_FILE)) {
    try {
      fs.unlinkSync(ENROLLED_FLAG_FILE);
    } catch (_) {}
  }
  return await getEnrollmentSetup(true);
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
 * Issue signed visitor session cookie token.
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
 * Issue signed admin session cookie token.
 */
export function createAdminToken() {
  const payload = {
    role: 'admin',
    exp: Date.now() + ADMIN_SESSION_DURATION_MS,
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
 * Verify a signed token (visitor or admin).
 */
export function verifySessionToken(token, requiredRole = null) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadStr, signature] = parts;

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

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
    if (!payload.exp || typeof payload.exp !== 'number') return false;
    if (Date.now() > payload.exp) return false;
    if (requiredRole && payload.role !== requiredRole) return false;
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

/**
 * Check if request has an active valid admin session.
 */
export function isAdminRequest(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  const token = cookies['urbana_admin_session'];
  return verifySessionToken(token, 'admin');
}
