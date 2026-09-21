import { adminSetupHtml } from '../../server/adminTemplate.js';
import { handleCors } from '../_helper.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.statusCode = 200;
  res.end(adminSetupHtml);
}
