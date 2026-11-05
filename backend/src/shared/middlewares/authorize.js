const { hasPermission } = require('../../modules/access/roles');
const config = require('../../../config/auth');
const HttpError = require('../utils/http-error');

function requirePermission(permission) {
  return function (req, res, next) {
    if (!hasPermission(req.user?.role, permission)) throw new HttpError(403, 'Anda tidak memiliki izin');
    if (req.user.role === 'HRD/Admin' && config.requireAdminMfa() && !req.session.mfa_verified) {
      throw new HttpError(403, 'Aktifkan MFA dan login dengan MFA sebelum mengelola akses');
    }
    next();
  };
}

function requireRecentAuth(req, res, next) {
  const verified = new Date(req.session?.verified_at).getTime();
  if (!Number.isFinite(verified) || Date.now() - verified > 5 * 60 * 1000) {
    throw new HttpError(401, 'Autentikasi ulang diperlukan');
  }
  next();
}

module.exports = { requirePermission, requireRecentAuth };
