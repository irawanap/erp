const { z } = require('zod');
const { email, password } = require('../../shared/validators/common');

const credentials = {
  password: z.string().min(1).max(72).refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password maksimal 72 byte',
  ),
  otp: z.string().regex(/^\d{6}$/).optional(),
  recoveryCode: z.string().regex(/^[a-f0-9]{32}$/).optional(),
};
const oneFactor = (value) => !(value.otp && value.recoveryCode);
const register = z.object({ email, password }).strict();
const login = z.object({ email, ...credentials })
  .strict().refine(oneFactor, 'Gunakan OTP atau recovery code, bukan keduanya');
const proof = z.object({
  currentPassword: credentials.password, otp: credentials.otp, recoveryCode: credentials.recoveryCode,
}).strict().refine(oneFactor, 'Gunakan OTP atau recovery code, bukan keduanya');
const changePassword = z.object({
  currentPassword: credentials.password, newPassword: password,
  otp: credentials.otp, recoveryCode: credentials.recoveryCode,
}).strict().refine(oneFactor, 'Gunakan OTP atau recovery code, bukan keduanya')
  .refine((value) => value.newPassword !== value.currentPassword, 'Password baru harus berbeda');
const code = z.object({ otp: z.string().regex(/^\d{6}$/) }).strict();

module.exports = { register, login, proof, changePassword, code };
