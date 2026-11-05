const { randomBytes, createHash, createHmac, timingSafeEqual } = require('node:crypto');
const config = require('../../../config/auth');

function generate() {
  return randomBytes(32).toString('hex');
}

function hash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function csrf(token) {
  return createHmac('sha256', config.secret()).update(`csrf:${token}`).digest('hex');
}

function equal(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

module.exports = { generate, hash, csrf, equal };
