const crypto = require('crypto');

// Hash i verificació de contrasenyes (PBKDF2) i de tokens de reinici.
// Mou el contingut de server.js, sense canviar comportament.

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function verifyPassword(password, user) {
  if (!user || !user.passwordHash || !user.passwordSalt) return false;
  const hash = crypto.pbkdf2Sync(password, user.passwordSalt, 10000, 64, 'sha512').toString('hex');
  return hash === user.passwordHash;
}

function setPasswordFields(password) {
  const { salt, hash } = hashPassword(password);
  return { passwordSalt: salt, passwordHash: hash };
}

module.exports = { hashPassword, hashResetToken, verifyPassword, setPasswordFields };
