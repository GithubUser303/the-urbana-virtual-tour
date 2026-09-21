import { handleCors, clearCookie, sendJson } from '../_helper.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  clearCookie(res, 'urbana_session');
  // Also clear legacy admin cookie if present
  res.setHeader('Set-Cookie', [
    'urbana_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    'urbana_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  ]);
  return sendJson(res, 200, { success: true });
}

