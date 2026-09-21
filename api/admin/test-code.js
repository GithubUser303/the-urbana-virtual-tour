import { isAdminRequest, getActiveTOTPSecret } from '../../server/auth.js';
import { verifyTOTP } from '../../server/totp.js';
import { handleCors, readBody, sendJson } from '../_helper.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  if (!isAdminRequest(req.headers.cookie)) {
    return sendJson(res, 401, { error: 'Unauthorized administrator access' });
  }

  const body = await readBody(req);
  const code = (body?.code || '').toString().trim();
  const secret = getActiveTOTPSecret();
  const valid = secret ? verifyTOTP(code, secret, 1) : false;

  return sendJson(res, 200, { valid });
}
