const crypto = require('crypto');

const sessions = new Map();

function getCookieOptions(req, extra = {}) {
  const forwardedProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
  const secure = req.secure || forwardedProto === 'https';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    ...extra
  };
}

function createSession(user, provider = 'local') {
  const sessionId = crypto.randomBytes(24).toString('hex');
  sessions.set(sessionId, {
    userId: user._id ? user._id.toString() : user.id,
    role: user.role || 'editor',
    provider,
    email: user.email,
    nickname: user.nickname || ''
  });
  return sessionId;
}

function parseCookies(header) {
  const list = {};
  if (!header) return list;
  header.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift().trim();
    const value = decodeURIComponent(parts.join('='));
    list[key] = value;
  });
  return list;
}

module.exports = {
  sessions,
  getCookieOptions,
  createSession,
  parseCookies
};
