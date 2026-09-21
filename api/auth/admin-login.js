import { handleAdminLogin, ADMIN_SESSION_DURATION_MS } from '../../server/auth.js';
import { handleCors, readBody, sendJson, getClientIp, setSessionCookie } from '../_helper.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  try {
    const body = await readBody(req);
    const username = (body?.username || '').toString().trim();
    const password = (body?.password || '').toString();
    const clientIp = getClientIp(req);

    if (!username || !password) {
      return sendJson(res, 400, {
        success: false,
        error: 'Please provide both username and password.'
      });
    }

    const result = handleAdminLogin(username, password, clientIp);

    if (result.success) {
      // Set session cookie for admin
      setSessionCookie(res, req, 'urbana_session', result.token);
      return sendJson(res, 200, { success: true, role: 'admin' });
    }

    return sendJson(res, result.statusCode || 401, {
      success: false,
      error: result.error || 'Invalid username or password.'
    });
  } catch (err) {
    console.error('[api/auth/admin-login] Internal error:', err);
    return sendJson(res, 500, {
      success: false,
      error: 'Unable to connect to authentication service. Please try again.'
    });
  }
}

