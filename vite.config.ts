import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  handleVerifyCode,
  isAuthenticatedRequest,
  isAdminRequest,
  verifyAdminPassword,
  createAdminToken,
  getEnrollmentSetup,
  confirmEnrollment,
  resetEnrollment,
  getActiveTOTPSecret,
  SESSION_DURATION_MS,
  ADMIN_SESSION_DURATION_MS
} from './server/auth.js';
import { verifyTOTP } from './server/totp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ADMIN_HTML_FILE = path.resolve(__dirname, 'server/admin-setup.html');

function urbanaAuthDevPlugin(): Plugin {
  return {
    name: 'urbana-auth-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? new URL(req.url, 'http://localhost') : null;
        if (!url) return next();

        const pathname = url.pathname;
        const clientIp =
          (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
          req.socket.remoteAddress ||
          '127.0.0.1';

        // 1. ADMIN UI: /admin/setup or /admin
        if (pathname === '/admin/setup' || pathname === '/admin') {
          try {
            const html = fs.readFileSync(ADMIN_HTML_FILE, 'utf-8');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store');
            res.end(html);
            return;
          } catch {
            res.statusCode = 500;
            res.end('Admin setup template missing');
            return;
          }
        }

        // Helper to parse JSON body
        const readJsonBody = (): Promise<any> => {
          return new Promise((resolve) => {
            let bodyStr = '';
            req.on('data', (chunk) => {
              bodyStr += chunk;
            });
            req.on('end', () => {
              try {
                resolve(JSON.parse(bodyStr || '{}'));
              } catch {
                resolve({});
              }
            });
          });
        };

        // 2. ADMIN API: Check Status
        if (pathname === '/api/admin/status' && req.method === 'GET') {
          const isAdmin = isAdminRequest(req.headers.cookie);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ isAdmin }));
          return;
        }

        // 3. ADMIN API: Login
        if (pathname === '/api/admin/login' && req.method === 'POST') {
          const body = await readJsonBody();
          const password = body?.password || '';
          res.setHeader('Content-Type', 'application/json');
          if (verifyAdminPassword(password)) {
            const token = createAdminToken();
            const cookieHeader = `urbana_admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
              ADMIN_SESSION_DURATION_MS / 1000
            )}`;
            res.setHeader('Set-Cookie', cookieHeader);
            res.end(JSON.stringify({ success: true }));
          } else {
            res.statusCode = 401;
            res.end(JSON.stringify({ success: false, error: 'Incorrect administrator password.' }));
          }
          return;
        }

        // 4. ADMIN API: Setup Data
        if (pathname === '/api/admin/setup-data' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          if (!isAdminRequest(req.headers.cookie)) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Unauthorized administrator access' }));
            return;
          }
          const data = await getEnrollmentSetup(false);
          res.end(JSON.stringify(data));
          return;
        }

        // 5. ADMIN API: Confirm Enrollment
        if (pathname === '/api/admin/confirm' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          if (!isAdminRequest(req.headers.cookie)) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Unauthorized administrator access' }));
            return;
          }
          const body = await readJsonBody();
          const result = confirmEnrollment(body?.code || '');
          if (result.success) {
            res.end(JSON.stringify({ success: true }));
          } else {
            res.statusCode = 400;
            res.end(JSON.stringify(result));
          }
          return;
        }

        // 6. ADMIN API: Reset Enrollment
        if (pathname === '/api/admin/reset' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          if (!isAdminRequest(req.headers.cookie)) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Unauthorized administrator access' }));
            return;
          }
          const data = await resetEnrollment();
          res.end(JSON.stringify(data));
          return;
        }

        // 7. ADMIN API: Test Code
        if (pathname === '/api/admin/test-code' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          if (!isAdminRequest(req.headers.cookie)) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Unauthorized administrator access' }));
            return;
          }
          const body = await readJsonBody();
          const secret = getActiveTOTPSecret();
          const valid = secret ? verifyTOTP(body?.code || '', secret, 1) : false;
          res.end(JSON.stringify({ valid }));
          return;
        }

        // 8. ADMIN API: Logout
        if (pathname === '/api/admin/logout' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Set-Cookie', 'urbana_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // 9. VISITOR API: Check Auth Status
        if (pathname === '/api/auth/status' && req.method === 'GET') {
          const isAuthed = isAuthenticatedRequest(req.headers.cookie);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ authenticated: isAuthed }));
          return;
        }

        // 10. VISITOR API: Verify TOTP Code
        if (pathname === '/api/auth/verify' && req.method === 'POST') {
          const body = await readJsonBody();
          const code = (body?.code || '').toString().trim();
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');

          if (!code || code.length !== 6) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Please enter a complete 6-digit code.' }));
            return;
          }

          const result = handleVerifyCode(code, clientIp);

          if (result.success) {
            const cookieHeader = `urbana_session=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
              SESSION_DURATION_MS / 1000
            )}`;
            res.setHeader('Set-Cookie', cookieHeader);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
          } else {
            const isRateLimited = (result.error || '').toLowerCase().includes('too many');
            res.statusCode = isRateLimited ? 429 : 401;
            res.end(JSON.stringify({ success: false, error: result.error }));
          }
          return;
        }

        // 11. VISITOR API: Logout
        if (pathname === '/api/auth/logout' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Set-Cookie', 'urbana_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // 12. Asset Protection in Dev
        const isProtectedAsset =
          pathname.startsWith('/assets/panoramas/') ||
          pathname.startsWith('/assets/gallery/');

        if (isProtectedAsset) {
          const isAuthed = isAuthenticatedRequest(req.headers.cookie);
          if (!isAuthed) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: 'Access denied. Valid authentication session required.'
              })
            );
            return;
          }
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [urbanaAuthDevPlugin()],
  server: {
    port: 3000,
    open: false,
    host: true,
    watch: {
      ignored: ['**/public/assets/**', '**/.git/**', '**/scratch/**']
    }
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0
  }
});
