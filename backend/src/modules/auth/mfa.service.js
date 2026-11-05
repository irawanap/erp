const { randomBytes } = require('node:crypto');
const Mfa = require('./mfa.model');
const crypto = require('./mfa.crypto');
const tokens = require('./session-token');
const Audit = require('../audit/audit.model');
const HttpError = require('../../shared/utils/http-error');

async function verify(account, input) {
  const enrollment = await Mfa.find(account.id);
  if (!enrollment?.enabled) return false;
  let valid = false;
  if (input.otp) {
    const counter = crypto.counter(crypto.decrypt(enrollment.encrypted_secret, account.id), input.otp);
    if (counter !== null) valid = await Mfa.consumeCounter(account.id, counter);
  } else if (input.recoveryCode) {
    valid = await Mfa.consumeRecovery(account.id, tokens.hash(input.recoveryCode));
    if (valid) await Audit.record('mfa.recovery_used', account.public_id, account.public_id);
  }
  if (!valid) {
    await Audit.record('mfa.failed', null, account.public_id);
    throw new HttpError(401, 'Email, password, atau kode autentikasi salah');
  }
  return true;
}

async function setup(account, sessionHash) {
  const generated = crypto.generate(account.email);
  await Mfa.setup(account.id, crypto.encrypt(generated.secret, account.id), sessionHash);
  await Audit.record('mfa.setup', account.public_id, account.public_id);
  return generated;
}

async function confirm(account, sessionHash, code) {
  const enrollment = await Mfa.find(account.id);
  if (!enrollment || enrollment.enabled || enrollment.pending_session_hash !== sessionHash) {
    throw new HttpError(409, 'Setup MFA tidak tersedia');
  }
  const counter = crypto.counter(crypto.decrypt(enrollment.encrypted_secret, account.id), code);
  if (counter === null) throw new HttpError(401, 'Kode autentikasi salah');
  const recoveryCodes = Array.from({ length: 8 }, () => randomBytes(16).toString('hex'));
  await Mfa.enable(account, enrollment.encrypted_secret, sessionHash, counter, recoveryCodes.map(tokens.hash));
  return recoveryCodes;
}

module.exports = { verify, setup, confirm };
