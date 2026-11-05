const tokens = require('../../modules/auth/session-token');
const HttpError = require('../utils/http-error');

function requireCsrf(req, res, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const submitted = req.get('x-csrf-token');
    if (!req.sessionToken || !tokens.equal(submitted, tokens.csrf(req.sessionToken))) {
      throw new HttpError(403, 'CSRF token tidak valid');
    }
  }
  next();
}

module.exports = { requireCsrf };
