jest.mock('../../config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/modules/auth/mfa.model');
jest.mock('../../src/modules/audit/audit.model', () => ({ record: jest.fn() }));
const OTPAuth = require('otpauth');
const Mfa = require('../../src/modules/auth/mfa.model');
const crypto = require('../../src/modules/auth/mfa.crypto');
const service = require('../../src/modules/auth/mfa.service');
const tokens = require('../../src/modules/auth/session-token');
const account = { id: '7', public_id: '77777777-7777-4777-8777-777777777777', email: 'mfa@example.com' };
beforeEach(() => {
  jest.resetAllMocks();
  process.env.MFA_ENCRYPTION_KEY = 'a'.repeat(64);
});
test('encrypts authenticator secret with authenticated encryption bound to the user', () => {
  const { secret } = crypto.generate(account.email);
  const encrypted = crypto.encrypt(secret, account.id);
  expect(encrypted).not.toContain(secret);
  expect(crypto.decrypt(encrypted, account.id)).toBe(secret);
  expect(() => crypto.decrypt(encrypted, '8')).toThrow();
  const parts = encrypted.split('.');
  parts[1] = Buffer.alloc(16).toString('base64');
  expect(() => crypto.decrypt(parts.join('.'), account.id)).toThrow();
});
test('setup binds pending enrollment to the current session', async () => {
  const result = await service.setup(account, 'session-hash');
  expect(result.uri).toContain('otpauth://totp/');
  expect(result.secret).toMatch(/^[A-Z2-7]+$/);
  expect(Mfa.setup.mock.calls[0][0]).toBe(account.id);
  expect(Mfa.setup.mock.calls[0][2]).toBe('session-hash');
});
test('MFA-disabled account needs no extra factor', async () => {
  Mfa.find.mockResolvedValue(null);
  expect(await service.verify(account, {})).toBe(false);
});
test('verifies TOTP and rejects replayed counter', async () => {
  const { secret } = crypto.generate(account.email);
  Mfa.find.mockResolvedValue({ enabled: true, encrypted_secret: crypto.encrypt(secret, account.id) });
  const otp = new OTPAuth.TOTP({ secret }).generate();
  Mfa.consumeCounter.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect(await service.verify(account, { otp })).toBe(true);
  await expect(service.verify(account, { otp })).rejects.toMatchObject({ status: 401 });
});
test('MFA-enabled account requires a code', async () => {
  Mfa.find.mockResolvedValue({ enabled: true });
  await expect(service.verify(account, {})).rejects.toMatchObject({ status: 401 });
});
test('consumes recovery code hash, never plaintext, once', async () => {
  Mfa.find.mockResolvedValue({ enabled: true });
  const recoveryCode = 'f'.repeat(32);
  Mfa.consumeRecovery.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect(await service.verify(account, { recoveryCode })).toBe(true);
  expect(Mfa.consumeRecovery).toHaveBeenCalledWith(account.id, tokens.hash(recoveryCode));
  await expect(service.verify(account, { recoveryCode })).rejects.toMatchObject({ status: 401 });
});
test('confirmation returns eight recovery codes and stores only hashes', async () => {
  const { secret } = crypto.generate(account.email);
  const encrypted = crypto.encrypt(secret, account.id);
  Mfa.find.mockResolvedValue({ enabled: false, pending_session_hash: 'session', encrypted_secret: encrypted });
  const otp = new OTPAuth.TOTP({ secret }).generate();
  const codes = await service.confirm(account, 'session', otp);
  expect(new Set(codes).size).toBe(8);
  expect(Mfa.enable.mock.calls[0][4]).toEqual(codes.map(tokens.hash));
});
test('does not confirm enrollment from another session', async () => {
  Mfa.find.mockResolvedValue({ enabled: false, pending_session_hash: 'other' });
  await expect(service.confirm(account, 'session', '123456')).rejects.toMatchObject({ status: 409 });
  expect(Mfa.enable).not.toHaveBeenCalled();
});
test('permission lookup denies unknown roles and permissions', () => {
  const { hasPermission } = require('../../src/modules/access/roles');
  expect(hasPermission('Employee', 'users:write')).toBe(false);
  expect(hasPermission('Supervisor', 'users:read')).toBe(false);
  expect(hasPermission('toString', 'users:read')).toBe(false);
  expect(hasPermission('HRD/Admin', 'unknown')).toBe(false);
  expect(hasPermission('HRD/Admin', 'users:write')).toBe(true);
});
