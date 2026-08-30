const crypto = require('crypto');
const { randomUUID } = require('crypto');
const { getDb } = require('../db');

const SESSION_COOKIE = 'xfa_session';
const CSRF_COOKIE = 'xfa_csrf';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function readCookies(req) {
  const cookie = String(req.headers.cookie || '');
  const result = {};
  for (const part of cookie.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

function appendCookie(res, value) {
  const current = res.getHeader('Set-Cookie');
  if (!current) res.setHeader('Set-Cookie', [value]);
  else if (Array.isArray(current)) res.setHeader('Set-Cookie', [...current, value]);
  else res.setHeader('Set-Cookie', [String(current), value]);
}

function cookieLine(name, value, { httpOnly = false, maxAge = null } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (httpOnly) parts.push('HttpOnly');
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  if (maxAge != null) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge / 1000))}`);
  return parts.join('; ');
}

function createSession(user, req, res) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  db.prepare('DELETE FROM user_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL').run(now.toISOString());
  db.prepare(
    `INSERT INTO user_sessions
      (id, user_id, token_hash, csrf_hash, expires_at, last_seen_at, created_ip_hash, user_agent_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    user.id,
    hash(token),
    hash(csrf),
    expiresAt.toISOString(),
    now.toISOString(),
    hash(req.ip),
    hash(req.headers['user-agent'])
  );

  appendCookie(res, cookieLine(SESSION_COOKIE, token, { httpOnly: true, maxAge: SESSION_TTL_MS }));
  appendCookie(res, cookieLine(CSRF_COOKIE, csrf, { maxAge: SESSION_TTL_MS }));
  return { expiresAt: expiresAt.toISOString() };
}

function findSession(req) {
  const token = readCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const now = new Date().toISOString();
  const row = getDb()
    .prepare(
      `SELECT s.id AS session_id, s.user_id, s.csrf_hash, s.expires_at,
              u.id, u.username, u.role, u.name, u.email, u.student_id
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?`
    )
    .get(hash(token), now);
  if (!row) return null;
  getDb().prepare('UPDATE user_sessions SET last_seen_at = ? WHERE id = ?').run(now, row.session_id);
  return row;
}

function revokeSession(req) {
  const token = readCookies(req)[SESSION_COOKIE];
  if (token) {
    getDb()
      .prepare('UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
      .run(new Date().toISOString(), hash(token));
  }
}

function revokeUserSessions(userId, exceptSessionId = null) {
  const now = new Date().toISOString();
  if (exceptSessionId) {
    return getDb()
      .prepare('UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL')
      .run(now, userId, exceptSessionId);
  }
  return getDb()
    .prepare('UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
    .run(now, userId);
}

function clearSessionCookies(res) {
  appendCookie(res, cookieLine(SESSION_COOKIE, '', { httpOnly: true, maxAge: 0 }));
  appendCookie(res, cookieLine(CSRF_COOKIE, '', { maxAge: 0 }));
}

function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path === '/auth/login') return next();
  const cookies = readCookies(req);
  if (!cookies[SESSION_COOKIE]) return next();
  const csrf = req.headers['x-csrf-token'];
  const session = getDb().prepare(
    'SELECT csrf_hash FROM user_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?'
  ).get(hash(cookies[SESSION_COOKIE]), new Date().toISOString());
  const headerHash = hash(csrf);
  const cookieHash = hash(cookies[CSRF_COOKIE]);
  if (!csrf || !cookies[CSRF_COOKIE] || !session ||
      !crypto.timingSafeEqual(Buffer.from(headerHash), Buffer.from(cookieHash)) ||
      !crypto.timingSafeEqual(Buffer.from(headerHash), Buffer.from(session.csrf_hash))) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }
  next();
}

module.exports = {
  SESSION_COOKIE,
  CSRF_COOKIE,
  createSession,
  findSession,
  revokeSession,
  revokeUserSessions,
  clearSessionCookies,
  csrfProtection,
  readCookies,
};
