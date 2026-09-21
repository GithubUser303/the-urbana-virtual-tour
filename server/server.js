import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  handleVerifyCode,
  isAuthenticatedRequest,
  SESSION_DURATION_MS
} from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

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
      // Protect against large payload flood
      if (body.length > 10000) {
        req.destroy();
        resolve(null);
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
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

  // 1. API: Check Authentication Status
  if (pathname === '/api/auth/status' && req.method === 'GET') {
    const isAuthed = isAuthenticatedRequest(req.headers.cookie);
    return sendJson(res, 200, { authenticated: isAuthed });
  }

  // 2. API: Verify TOTP Code
  if (pathname === '/api/auth/verify' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    if (!body || !body.code) {
      return sendJson(res, 400, {
        success: false,
        error: 'Please enter a valid 6-digit authentication code.'
      });
    }

    const result = handleVerifyCode(body.code, clientIp);

    if (result.success) {
      const cookieHeader = `urbana_session=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
        SESSION_DURATION_MS / 1000
      )}`;
      return sendJson(
        res,
        200,
        { success: true },
        { 'Set-Cookie': cookieHeader }
      );
    } else {
      return sendJson(res, 401, { success: false, error: result.error });
    }
  }

  // 3. API: Logout
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const cookieHeader = `urbana_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
    return sendJson(res, 200, { success: true }, { 'Set-Cookie': cookieHeader });
  }

  // 4. PROTECTED ASSETS ACCESS CONTROL
  // Prevent unauthorized access to high-res property panoramas and gallery assets
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

  // 5. Static File Serving from dist/
  let filePath = path.join(DIST_DIR, pathname);

  // Normalize and prevent path traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  // Check if target is a file or fallback to index.html for SPA routing
  let stat = null;
  try {
    stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = fs.statSync(filePath);
    }
  } catch {
    // If not found and client requests an HTML navigation, serve index.html
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

  // Cache policy
  let cacheControl = 'public, max-age=3600';
  if (ext === '.html') {
    cacheControl = 'no-cache, must-revalidate';
  } else if (filePath.includes('/assets/')) {
    // Fingerprinted assets can be cached aggressively
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
  console.log(`The Urbana Secure Virtual Tour running at http://localhost:${PORT}`);
});
