const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const OTPAuth = require('otpauth');
const config = require('../../../config/auth');

function authenticator(secret, email = '') {
  return new OTPAuth.TOTP({ issuer: 'HRD ERP', label: email, algorithm: 'SHA1', digits: 6, period: 30, secret });
}

function generate(email) {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  return { secret, uri: authenticator(secret, email).toString() };
}

function counter(secret, code) {
  const now = Date.now();
  const delta = authenticator(secret).validate({ token: code, window: 1, timestamp: now });
  return delta === null ? null : Math.floor(now / 30000) + delta;
}

function encrypt(secret, userId) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', config.encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`hrd-mfa:${userId}`));
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.');
}

function decrypt(value, userId) {
  const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', config.encryptionKey(), iv);
  decipher.setAAD(Buffer.from(`hrd-mfa:${userId}`));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { generate, counter, encrypt, decrypt };
