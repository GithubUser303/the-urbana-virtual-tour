import { handleCors, clearCookie, sendJson } from '../_helper.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  clearCookie(res, 'urbana_session');
  return sendJson(res, 200, { success: true });
}

