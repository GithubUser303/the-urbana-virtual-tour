import { verifyAdminPassword, createAdminToken, ADMIN_SESSION_DURATION_MS } from '../../server/auth.js';
import { handleCors, readBody, sendJson, setCookie } from '../_helper.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  const body = await readBody(req);
  const password = body?.password || '';

  if (verifyAdminPassword(password)) {
    const token = createAdminToken();
    setCookie(res, req, 'urbana_admin_session', token, ADMIN_SESSION_DURATION_MS);
    return sendJson(res, 200, { success: true });
  } else {
    return sendJson(res, 401, { success: false, error: 'Incorrect administrator password.' });
  }
}
