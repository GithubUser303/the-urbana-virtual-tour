import { handleVerifyCode } from '../../server/auth.js';
import { handleCors, readBody, sendJson, getClientIp, setSessionCookie } from '../_helper.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  try {
    const body = await readBody(req);
    const code = (body?.code || '').toString().trim();
    const clientIp = getClientIp(req);

    if (!code || code.length !== 6) {
      return sendJson(res, 400, {
        success: false,
        error: 'Please enter a complete 6-digit code.'
      });
    }

    const result = handleVerifyCode(code, clientIp);

    if (result.success) {
      // Browser Session Cookie (omits Max-Age/Expires so closing the browser/tab clears it)
      setSessionCookie(res, req, 'urbana_session', result.token);
      return sendJson(res, 200, { success: true });
    }

    // Check if error is rate limit
    const isRateLimited = (result.error || '').toLowerCase().includes('too many');
    const statusCode = isRateLimited ? 429 : 401;

    return sendJson(res, statusCode, {
      success: false,
      error: result.error || 'Invalid or expired authentication code.'
    });
  } catch (err) {
    console.error('[api/auth/verify] Internal error:', err);
    return sendJson(res, 500, {
      success: false,
      error: 'Unable to connect to authentication service. Please try again.'
    });
  }
}

