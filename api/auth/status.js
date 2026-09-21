import { inspectVisitorSession } from '../../server/auth.js';
import { handleCors, sendJson } from '../_helper.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
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
  } catch (err) {
    console.error('[api/auth/status] Error:', err);
    return sendJson(res, 200, { authenticated: false, role: null, expired: false });
  }
}

