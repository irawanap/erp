const config = require('../../../config/auth');
const HttpError = require('../utils/http-error');

function allowedOrigins() {
  return (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',').map((value) => value.trim()).filter(Boolean);
}

function security(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (config.production() && !req.secure) throw new HttpError(400, 'HTTPS diperlukan');
  const origin = req.get('origin');
  if ((origin && !allowedOrigins().includes(origin)) || req.get('sec-fetch-site') === 'cross-site') {
    throw new HttpError(403, 'Origin tidak diizinkan');
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'Content-Type harus application/json');
  }
  next();
}

module.exports = { security, allowedOrigins };
