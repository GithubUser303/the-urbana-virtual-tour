import { isAdminRequest } from '../../server/auth.js';
import { handleCors, sendJson } from '../_helper.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  const isAdmin = isAdminRequest(req.headers.cookie);
  return sendJson(res, 200, { isAdmin });
}
