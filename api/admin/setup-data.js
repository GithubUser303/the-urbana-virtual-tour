import { isAdminRequest, getEnrollmentSetup } from '../../server/auth.js';
import { handleCors, sendJson } from '../_helper.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  if (!isAdminRequest(req.headers.cookie)) {
    return sendJson(res, 401, { error: 'Unauthorized administrator access' });
  }

  try {
    const data = await getEnrollmentSetup(false);
    return sendJson(res, 200, data);
  } catch (err) {
    console.error('[api/admin/setup-data] Error:', err);
    return sendJson(res, 500, { error: 'Failed to generate setup data' });
  }
}
