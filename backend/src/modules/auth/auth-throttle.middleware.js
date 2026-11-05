const { createHmac } = require('node:crypto');
const { ipKeyGenerator } = require('express-rate-limit');
const config = require('../../../config/auth');
const Throttle = require('./auth-throttle.model');
const HttpError = require('../../shared/utils/http-error');

function throttle(scope, limit, seconds, key = (req) => ipKeyGenerator(req.ip)) {
  return async function (req, res, next) {
    const digest = createHmac('sha256', config.secret())
      .update(`${scope}:${key(req)}`).digest('hex');
    const result = await Throttle.increment(digest, seconds);
    if (result.attempts > limit) {
      res.set('Retry-After', String(result.retry_after));
      throw new HttpError(429, 'Terlalu banyak percobaan, coba lagi nanti');
    }
    next();
  };
}

module.exports = { throttle };
