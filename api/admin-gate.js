// Admin gate: verify password, set cookie, redirect to /admin.
// Set env ADMIN_GATE_PASSWORD in Vercel (Project → Settings → Environment Variables).
// Optional: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for persistent rate limiting (same 5 attempts / 15 min).

const crypto = require('crypto');
const COOKIE_NAME = 'admin_gate_verified';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW_SEC = 15 * 60; // 900
const MAX_ATTEMPTS = 5;
const SUPABASE_FETCH_TIMEOUT_MS = 15_000; // Prevent hanging on Supabase calls
const failedAttempts = new Map(); // IP -> { count, firstAttempt } (fallback when Supabase not configured)

function sha256(ip) {
  return crypto.createHash('sha256').update(ip || '').digest('hex');
}

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  
  if (!record) return false;
  
  // Reset if window has passed
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    failedAttempts.delete(ip);
    return false;
  }
  
  return record.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  
  if (!record || now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    failedAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

function clearFailedAttempts(ip) {
  failedAttempts.delete(ip);
}

/** Persistent rate limit via Supabase (optional). Returns true if limited. Falls back to false on error so we can use in-memory. */
async function isPersistentRateLimited(ip) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const rateKey = 'admin-gate:' + sha256(ip);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url + '/rest/v1/rate_limit_entries?key=eq.' + encodeURIComponent(rateKey) + '&select=count,window_end', {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return false;
    const row = rows[0];
    const count = row && (row.count != null) ? Number(row.count) : 0;
    const windowEnd = row && row.window_end ? new Date(row.window_end).getTime() : 0;
    if (count >= MAX_ATTEMPTS && windowEnd > Date.now()) return true;
    return false;
  } catch (e) {
    if (e && e.name === 'AbortError') {
      console.warn('[admin-gate] Rate limit check timeout, using in-memory fallback');
    }
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Increment persistent rate limit on failed attempt. No-op if Supabase not configured. */
async function recordFailedAttemptPersistent(ip) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const rateKey = 'admin-gate:' + sha256(ip);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);
  try {
    await fetch(url + '/rest/v1/rpc/check_and_increment_rate_limit', {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_key: rateKey,
        p_max: MAX_ATTEMPTS,
        p_window_sec: RATE_LIMIT_WINDOW_SEC,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') {
      console.warn('[admin-gate] Record rate limit timeout');
    }
    // ignore other errors
  } finally {
    clearTimeout(timeoutId);
  }
}

function getPasswordFromBody(body) {
  if (!body || typeof body !== 'string') return '';
  const params = new URLSearchParams(body);
  return params.get('password') || '';
}

/** Try to read raw body from request (for runtimes that do not pre-parse body). */
function getRawBody(req) {
  if (!req || typeof req.on !== 'function') return Promise.resolve('');
  return new Promise((resolve) => {
    let data = '';
    const timeout = setTimeout(() => resolve(data), 8000);
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      clearTimeout(timeout);
      resolve(typeof data === 'string' ? data : (Buffer.isBuffer(data) ? data.toString('utf8') : ''));
    });
    req.on('error', () => {
      clearTimeout(timeout);
      resolve('');
    });
  });
}

/** Extract password from request; works with Vercel (parsed body) and raw body. */
async function extractPassword(req) {
  let password = '';
  const body = req.body;
  if (body != null) {
    if (typeof body === 'string') {
      password = getPasswordFromBody(body);
    } else if (typeof body === 'object' && body !== null && 'password' in body) {
      password = body.password != null ? String(body.password) : '';
    } else if (Buffer.isBuffer(body)) {
      password = getPasswordFromBody(body.toString('utf8'));
    }
  }
  if (password === '' && req) {
    try {
      const raw = await getRawBody(req);
      password = getPasswordFromBody(typeof raw === 'string' ? raw : '');
    } catch {
      // Body already consumed or stream error; leave password empty
    }
  }
  return password;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }

  const clientIP = getClientIP(req);

  const persistentLimited = await isPersistentRateLimited(clientIP);
  if (persistentLimited) {
    console.warn(`[admin-gate] Rate limited (persistent): ${clientIP}`);
    return res.status(429).send('Too many attempts. Please try again later.');
  }

  if (isRateLimited(clientIP)) {
    console.warn(`[admin-gate] Rate limited: ${clientIP}`);
    return res.status(429).send('Too many attempts. Please try again later.');
  }

  const expected = process.env.ADMIN_GATE_PASSWORD;
  if (!expected) {
    console.error('ADMIN_GATE_PASSWORD is not set');
    return res.status(500).send('Gate not configured');
  }

  const password = await extractPassword(req);

  if (password.length === 0) {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(400).send('Missing password');
  }

  const ok = password === expected;
  if (!ok) {
    recordFailedAttempt(clientIP);
    await recordFailedAttemptPersistent(clientIP);
    console.warn(`[admin-gate] Failed attempt from ${clientIP}`);
    return res.status(401).send('Invalid password');
  }

  clearFailedAttempts(clientIP);

  res.setHeader('Set-Cookie', `${COOKIE_NAME}=1; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Strict`);
  return res.redirect(302, '/admin');
}

