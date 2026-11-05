const HttpError = require('../src/shared/utils/http-error');

function secret() {
  const value = process.env.SESSION_SECRET || (!production() && process.env.JWT_SECRET);
  if (!value || Buffer.byteLength(value) < 32) {
    throw new HttpError(503, 'SESSION_SECRET minimal 32 byte harus dikonfigurasi');
  }
  return value;
}

function production() {
  return process.env.NODE_ENV === 'production';
}

function cookieName() {
  return production() ? '__Host-hrd_session' : 'hrd_session';
}

function cookieOptions() {
  return { httpOnly: true, secure: production(), sameSite: 'strict', path: '/' };
}

function requireAdminMfa() {
  return production() || process.env.REQUIRE_ADMIN_MFA !== 'false';
}

function encryptionKey() {
  const value = process.env.MFA_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new HttpError(503, 'MFA_ENCRYPTION_KEY harus 64 karakter hex acak');
  }
  return Buffer.from(value, 'hex');
}

module.exports = { secret, production, cookieName, cookieOptions, requireAdminMfa, encryptionKey };
