/**
 * Serverless Helper utility for Vercel API functions.
 */

export function handleCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control');
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  return false;
}

export function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }

    if (typeof req.body === 'string') {
      try {
        return resolve(JSON.parse(req.body || '{}'));
      } catch {
        return resolve({});
      }
    }

    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      resolve({});
    });
  });
}

export function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.end(JSON.stringify(data));
}

export function getClientIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
}

export function setSessionCookie(res, req, name, value) {
  const isSecure =
    process.env.NODE_ENV === 'production' ||
    req.headers['x-forwarded-proto'] === 'https';
  // Omission of Max-Age and Expires makes this a browser-session cookie (RFC 6265)
  // The browser automatically removes it when the browser/tab session closes.
  const cookieStr = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${
    isSecure ? '; Secure' : ''
  }`;
  res.setHeader('Set-Cookie', cookieStr);
}

export function setCookie(res, req, name, value, maxAgeMs = null) {
  const isSecure =
    process.env.NODE_ENV === 'production' ||
    req.headers['x-forwarded-proto'] === 'https';
  
  let cookieStr = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${
    isSecure ? '; Secure' : ''
  }`;

  if (typeof maxAgeMs === 'number' && maxAgeMs > 0) {
    const maxAgeSec = Math.floor(maxAgeMs / 1000);
    cookieStr += `; Max-Age=${maxAgeSec}`;
  }

  res.setHeader('Set-Cookie', cookieStr);
}

export function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

