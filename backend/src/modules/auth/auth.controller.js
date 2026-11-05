const bcrypt = require('bcrypt');
const Auth = require('./auth.model');
const Mfa = require('./mfa.model');
const mfaService = require('./mfa.service');
const Audit = require('../audit/audit.model');
const publicUser = require('./public-user');
const config = require('../../../config/auth');
const service = require('./auth.service');
const schemas = require('./auth.validation');
const Session = require('./session.model');
const tokens = require('./session-token');
const { issueSession, clearCookie } = require('./session.middleware');
const HttpError = require('../../shared/utils/http-error');

async function csrf(req, res) {
  const csrfToken = req.sessionToken
    ? tokens.csrf(req.sessionToken) : await issueSession(res);
  res.json({ success: true, data: { csrfToken } });
}

function validateLogin(req, res, next) {
  req.loginInput = schemas.login.parse(req.body);
  next();
}

async function login(req, res) {
  const user = await service.login(req.loginInput);
  // Consume the old session once, so concurrent login requests cannot reuse it.
  if (!await Session.consume(req.session.token_hash)) {
    throw new HttpError(403, 'Session berubah, ambil CSRF token baru');
  }
  const csrfToken = await issueSession(res, user);
  res.json({ success: true, data: { user: publicUser(user), csrfToken } });
}

async function register(req, res) {
  if (process.env.ENABLE_PUBLIC_REGISTRATION !== 'true') {
    throw new HttpError(403, 'Registrasi publik dinonaktifkan');
  }
  const input = schemas.register.parse(req.body);
  await service.register(input);
  res.status(202).json({
    success: true,
    message: 'Permintaan registrasi diproses. Gunakan kredensial Anda untuk login.',
  });
}

function me(req, res) {
  res.json({ success: true, data: req.user });
}

async function logout(req, res) {
  await Session.remove(req.session.token_hash, req.user.id);
  clearCookie(res);
  res.json({ success: true, message: 'Logout berhasil' });
}

async function reauthenticate(req, res) {
  const input = schemas.proof.parse(req.body);
  const account = await service.login({ email: req.user.email, password: input.currentPassword,
    otp: input.otp, recoveryCode: input.recoveryCode });
  if (account.id !== req.session.user_id) throw new HttpError(401, 'Akun berubah, login ulang');
  if (!await Session.consume(req.session.token_hash)) throw new HttpError(401, 'Session berubah, login ulang');
  const csrfToken = await issueSession(res, account);
  await Audit.record('auth.reauthenticated', req.user.id, req.user.id);
  res.json({ success: true, data: { csrfToken } });
}

async function changePassword(req, res) {
  const input = schemas.changePassword.parse(req.body);
  const account = await service.login({ email: req.user.email, password: input.currentPassword,
    otp: input.otp, recoveryCode: input.recoveryCode });
  if (account.id !== req.session.user_id) throw new HttpError(401, 'Akun berubah, login ulang');
  await Auth.changePassword(account, await bcrypt.hash(input.newPassword, 12));
  clearCookie(res);
  res.json({ success: true, message: 'Password diubah. Silakan login kembali.' });
}

async function sessions(req, res) {
  const data = await Session.list(req.session.user_id, req.session.token_hash);
  res.json({ success: true, data });
}

async function revokeSession(req, res) {
  const id = require('../../shared/validators/common').id.parse(req.params.id);
  const revoked = await Session.revoke(req.session.user_id, id, req.user.id);
  if (!revoked) throw new HttpError(404, 'Session tidak ditemukan');
  if (revoked.token_hash === req.session.token_hash) clearCookie(res);
  res.json({ success: true, message: 'Session dicabut' });
}

async function logoutAll(req, res) {
  await Session.revokeAll(req.session.user_id, req.user.id);
  clearCookie(res);
  res.json({ success: true, message: 'Seluruh session dicabut' });
}

async function setupMfa(req, res) {
  const input = schemas.proof.parse(req.body);
  const account = await service.login({ email: req.user.email, password: input.currentPassword,
    otp: input.otp, recoveryCode: input.recoveryCode });
  if (account.id !== req.session.user_id) throw new HttpError(401, 'Akun berubah, login ulang');
  const data = await mfaService.setup(account, req.session.token_hash);
  res.json({ success: true, data });
}

async function confirmMfa(req, res) {
  const { otp } = schemas.code.parse(req.body);
  const account = await Auth.findByEmail(req.user.email);
  if (!account || account.id !== req.session.user_id || account.auth_version !== req.session.user_version) {
    throw new HttpError(401, 'Akun berubah, login ulang');
  }
  const recoveryCodes = await mfaService.confirm(account, req.session.token_hash, otp);
  clearCookie(res);
  res.json({ success: true, data: { recoveryCodes }, message: 'MFA aktif. Simpan recovery codes, lalu login kembali.' });
}

async function disableMfa(req, res) {
  if (req.user.role === 'HRD/Admin' && config.requireAdminMfa()) {
    throw new HttpError(403, 'MFA wajib untuk admin');
  }
  const input = schemas.proof.parse(req.body);
  const account = await service.login({ email: req.user.email, password: input.currentPassword,
    otp: input.otp, recoveryCode: input.recoveryCode });
  if (account.id !== req.session.user_id || !account.mfa_verified) throw new HttpError(401, 'Verifikasi MFA diperlukan');
  await Mfa.disable(account);
  clearCookie(res);
  res.json({ success: true, message: 'MFA dinonaktifkan. Silakan login kembali.' });
}

module.exports = { csrf, validateLogin, login, register, me, logout, reauthenticate, changePassword, sessions, revokeSession, logoutAll, setupMfa, confirmMfa, disableMfa };
