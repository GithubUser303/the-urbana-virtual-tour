import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  handleVerifyCode,
  handleAdminLogin,
  isAuthenticatedRequest,
  inspectVisitorSession,
  isAdminRequest,
  verifyAdminPassword,
  createAdminToken,
  getEnrollmentSetup,
  confirmEnrollment,
  resetEnrollment,
  getActiveTOTPSecret,
  SESSION_DURATION_MS,
  ADMIN_SESSION_DURATION_MS
} from './auth.js';
import { verifyTOTP } from './totp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const ADMIN_HTML_FILE = path.resolve(__dirname, 'admin-setup.html');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20000) {
        req.destroy();
        resolve(null);
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const clientIp =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  // 1. ADMIN UI ROUTE: /admin/setup or /admin
  if (pathname === '/admin/setup' || pathname === '/admin') {
    try {
      const html = fs.readFileSync(ADMIN_HTML_FILE, 'utf-8');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      return res.end(html);
    } catch (err) {
      res.writeHead(500);
      return res.end('Admin setup page template missing.');
    }
  }

  // 2. ADMIN API: Check Admin Login Status
  if (pathname === '/api/admin/status' && req.method === 'GET') {
    const isAdmin = isAdminRequest(req.headers.cookie);
    return sendJson(res, 200, { isAdmin });
  }

  // 3. ADMIN API: Admin Password Login
  if (pathname === '/api/admin/login' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const password = body?.password || '';
    if (verifyAdminPassword(password)) {
      const token = createAdminToken();
      const cookieHeader = `urbana_admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
        ADMIN_SESSION_DURATION_MS / 1000
      )}`;
      return sendJson(res, 200, { success: true }, { 'Set-Cookie': cookieHeader });
    } else {
      return sendJson(res, 401, { success: false, error: 'Incorrect administrator password.' });
    }
  }

  // 4. ADMIN API: Get Enrollment Data (QR Code & Secret)
  if (pathname === '/api/admin/setup-data' && req.method === 'GET') {
    if (!isAdminRequest(req.headers.cookie)) {
      return sendJson(res, 401, { error: 'Unauthorized administrator access' });
    }
    const data = await getEnrollmentSetup(false);
    return sendJson(res, 200, data);
  }

  // 5. ADMIN API: Confirm & Activate TOTP Enrollment
  if (pathname === '/api/admin/confirm' && req.method === 'POST') {
    if (!isAdminRequest(req.headers.cookie)) {
      return sendJson(res, 401, { error: 'Unauthorized administrator access' });
    }
    const body = await parseJsonBody(req);
    const code = body?.code || '';
    const result = confirmEnrollment(code);
    if (result.success) {
      return sendJson(res, 200, { success: true });
    } else {
      return sendJson(res, 400, result);
    }
  }

  // 6. ADMIN API: Reset Enrollment
  if (pathname === '/api/admin/reset' && req.method === 'POST') {
    if (!isAdminRequest(req.headers.cookie)) {
      return sendJson(res, 401, { error: 'Unauthorized administrator access' });
    }
    const data = await resetEnrollment();
    return sendJson(res, 200, data);
  }

  // 7. ADMIN API: Test Current Authenticator Code
  if (pathname === '/api/admin/test-code' && req.method === 'POST') {
    if (!isAdminRequest(req.headers.cookie)) {
      return sendJson(res, 401, { error: 'Unauthorized administrator access' });
    }
    const body = await parseJsonBody(req);
    const code = body?.code || '';
    const secret = getActiveTOTPSecret();
    const valid = secret ? verifyTOTP(code, secret, 1) : false;
    return sendJson(res, 200, { valid });
  }

  // 8. ADMIN API: Logout
  if (pathname === '/api/admin/logout' && req.method === 'POST') {
    const cookieHeader = `urbana_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
    return sendJson(res, 200, { success: true }, { 'Set-Cookie': cookieHeader });
  }

  // 8b. ADMIN API: Username + Password Login for Tour
  if (pathname === '/api/auth/admin-login' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const username = (body?.username || '').toString().trim();
    const password = (body?.password || '').toString();

    if (!username || !password) {
      return sendJson(res, 400, {
        success: false,
        error: 'Please provide both username and password.'
      });
    }

    const result = handleAdminLogin(username, password, clientIp);

    if (result.success) {
      const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
      const cookieHeader = `urbana_session=${result.token}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`;
      return sendJson(res, 200, { success: true, role: 'admin' }, { 'Set-Cookie': cookieHeader });
    } else {
      return sendJson(res, result.statusCode || 401, {
        success: false,
        error: result.error || 'Invalid username or password.'
      });
    }
  }

  // 9. VISITOR API: Check Visitor Authentication Status
  if (pathname === '/api/auth/status' && req.method === 'GET') {
    const inspection = inspectVisitorSession(req.headers.cookie);
    if (inspection.valid) {
      return sendJson(res, 200, {
        authenticated: true,
        role: inspection.role || 'user'
      });
    }
    return sendJson(res, 200, {
      authenticated: false,
      role: inspection.role || null,
      expired: !!inspection.expired
    });
  }

  // 10. VISITOR API: Verify TOTP Code
  if (pathname === '/api/auth/verify' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    if (!body || !body.code || body.code.toString().trim().length !== 6) {
      return sendJson(res, 400, {
        success: false,
        error: 'Please enter a complete 6-digit code.'
      });
    }

    const result = handleVerifyCode(body.code.toString().trim(), clientIp);

    if (result.success) {
      const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
      // Browser Session Cookie (omits Max-Age/Expires so closing the browser/tab clears it)
      const cookieHeader = `urbana_session=${result.token}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`;
      return sendJson(
        res,
        200,
        { success: true, role: 'user' },
        { 'Set-Cookie': cookieHeader }
      );
    } else {
      const isRateLimited = (result.error || '').toLowerCase().includes('too many');
      const statusCode = isRateLimited ? 429 : 401;
      return sendJson(res, statusCode, { success: false, error: result.error });
    }
  }

  // 11. VISITOR API: Logout
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Set-Cookie': [
        'urbana_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
        'urbana_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
      ]
    });
    return res.end(JSON.stringify({ success: true }));
  }

  // 12. PROTECTED ASSETS ACCESS CONTROL
  const isProtectedAsset =
    pathname.startsWith('/assets/panoramas/') ||
    pathname.startsWith('/assets/gallery/');

  if (isProtectedAsset) {
    const isAuthed = isAuthenticatedRequest(req.headers.cookie);
    if (!isAuthed) {
      return sendJson(res, 401, {
        error: 'Access denied. Valid authentication session required.'
      });
    }
  }

  // 13. Static File Serving from dist/
  let filePath = path.join(DIST_DIR, pathname);

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  let stat = null;
  try {
    stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = fs.statSync(filePath);
    }
  } catch {
    if (!path.extname(pathname)) {
      filePath = path.join(DIST_DIR, 'index.html');
      try {
        stat = fs.statSync(filePath);
      } catch {
        res.writeHead(404);
        return res.end('Build files not found. Run npm run build first.');
      }
    } else {
      res.writeHead(404);
      return res.end('Not Found');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  let cacheControl = 'public, max-age=3600';
  if (ext === '.html') {
    cacheControl = 'no-cache, must-revalidate';
  } else if (filePath.includes('/assets/')) {
    cacheControl = 'public, max-age=31536000, immutable';
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': cacheControl
  });

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`The Urbana Virtual Tour running at http://localhost:${PORT}`);
  console.log(`Administrator TOTP Setup available at http://localhost:${PORT}/admin/setup`);
});
