const bcrypt = require('bcrypt');
const Auth = require('./auth.model');
const Mfa = require('./mfa.service');
const Audit = require('../audit/audit.model');
const HttpError = require('../../shared/utils/http-error');

// A real bcrypt comparison is also performed for unknown email addresses.
const dummyHash = bcrypt.hashSync('not-a-real-account-password', 12);

async function login({ email, password, otp, recoveryCode }) {
  const account = await Auth.findByEmail(email);
  const matches = await bcrypt.compare(password, account?.password_hash || dummyHash);
  if (!account || !matches || !account.is_active || (account.employee_status && account.employee_status !== 'Active')) {
    await Audit.record('auth.login_failed');
    throw new HttpError(401, 'Email, password, atau kode autentikasi salah');
  }
  const mfaVerified = await Mfa.verify(account, { otp, recoveryCode });
  const user = await Auth.markLogin(account.id, account.auth_version);
  if (!user) throw new HttpError(401, 'Email, password, atau kode autentikasi salah');
  await Audit.record('auth.credentials_verified', user.public_id, user.public_id);
  return { ...user, mfa_verified: mfaVerified };
}

async function register({ email, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  await Auth.register({ email, passwordHash });
}

module.exports = { login, register };
