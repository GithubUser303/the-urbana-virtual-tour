import { defineConfig, type Plugin } from 'vite';
import {
  handleVerifyCode,
  isAuthenticatedRequest,
  SESSION_DURATION_MS
} from './server/auth.js';

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

        // 1. Check Auth Status
        if (pathname === '/api/auth/status' && req.method === 'GET') {
          const isAuthed = isAuthenticatedRequest(req.headers.cookie);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ authenticated: isAuthed }));
          return;
        }

        // 2. Verify TOTP Code
        if (pathname === '/api/auth/verify' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });
          req.on('end', () => {
            try {
              const body = JSON.parse(bodyStr || '{}');
              const result = handleVerifyCode(body.code, clientIp);

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'no-store');

              if (result.success) {
                const cookieHeader = `urbana_session=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
                  SESSION_DURATION_MS / 1000
                )}`;
                res.setHeader('Set-Cookie', cookieHeader);
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true }));
              } else {
                res.statusCode = 401;
                res.end(JSON.stringify({ success: false, error: result.error }));
              }
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Malformed request' }));
            }
          });
          return;
        }

        // 3. Logout
        if (pathname === '/api/auth/logout' && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Set-Cookie', 'urbana_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // 4. Asset Protection in Dev
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
