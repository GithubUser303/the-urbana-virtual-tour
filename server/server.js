import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // Static File Serving from dist/
  let filePath = path.join(DIST_DIR, pathname);

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  let stat = null;
  try {
    stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = fs.statSync(filePath);
    }
  } catch {
    if (!path.extname(pathname)) {
      filePath = path.join(DIST_DIR, 'index.html');
      try {
        stat = fs.statSync(filePath);
      } catch {
        res.writeHead(404);
        return res.end('Build files not found. Run npm run build first.');
      }
    } else {
      res.writeHead(404);
      return res.end('Not Found');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  let cacheControl = 'public, max-age=3600';
  if (ext === '.html') {
    cacheControl = 'no-cache, must-revalidate';
  } else if (filePath.includes('/assets/')) {
    cacheControl = 'public, max-age=31536000, immutable';
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': cacheControl
  });

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`The Urbana Virtual Tour running at http://localhost:${PORT}`);
});
