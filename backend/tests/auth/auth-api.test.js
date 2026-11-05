jest.mock('../../config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/modules/auth/session.model', () => ({
  find: jest.fn(), create: jest.fn(), consume: jest.fn(), remove: jest.fn(), touch: jest.fn(),
}));
jest.mock('../../src/modules/auth/auth.model');
jest.mock('../../src/modules/auth/mfa.model');
jest.mock('../../src/modules/audit/audit.model', () => ({ record: jest.fn() }));
jest.mock('../../src/modules/auth/auth-throttle.model', () => ({ increment: jest.fn() }));
jest.mock('pino-http', () => () => (req, res, next) => next());
const request = require('supertest');
const bcrypt = require('bcrypt');
const Session = require('../../src/modules/auth/session.model');
const Auth = require('../../src/modules/auth/auth.model');
const Throttle = require('../../src/modules/auth/auth-throttle.model');
const tokens = require('../../src/modules/auth/session-token');
const app = require('../../src/app');
const token = 'b'.repeat(64);
const password = 'my-long-password-for-tests';
let passwordHash;
let user;
beforeAll(async () => { passwordHash = await bcrypt.hash(password, 12); });
beforeEach(() => {
  jest.resetAllMocks();
  process.env.SESSION_SECRET = 'test-secret-with-at-least-32-bytes-long';
  process.env.ENABLE_PUBLIC_REGISTRATION = 'true';
  delete process.env.NODE_ENV;
  user = { id: '7', public_id: '77777777-7777-4777-8777-777777777777', email: 'employee@example.com', role: 'Employee', is_active: true, auth_version: 1 };
  Session.find.mockResolvedValue({ token_hash: tokens.hash(token), created_at: new Date() });
  Session.create.mockResolvedValue({ expires_at: new Date(Date.now() + 7200000) });
  Session.consume.mockResolvedValue(true);
  Throttle.increment.mockResolvedValue({ attempts: 1, retry_after: 900 });
});
function api(method, path) {
  return request(app)[method]('/api/v1/auth' + path)
    .set('Cookie', `hrd_session=${token}`).set('X-CSRF-Token', tokens.csrf(token));
}
function validAccount() {
  Auth.findByEmail.mockResolvedValue({ ...user, password_hash: passwordHash });
  Auth.markLogin.mockResolvedValue(user);
}

test('CSRF endpoint issues an anonymous HttpOnly SameSite cookie and no-store response', async () => {
  const response = await request(app).get('/api/v1/auth/csrf');
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
  expect(response.headers['set-cookie'][0]).toContain('SameSite=Strict');
  expect(response.body.data.csrfToken).toMatch(/^[a-f0-9]{64}$/);
  expect(Session.create.mock.calls[0][0]).toMatch(/^[a-f0-9]{64}$/);
  const cookie = response.headers['set-cookie'][0].split(';')[0].split('=')[1];
  expect(Session.create.mock.calls[0][0]).toBe(tokens.hash(cookie));
  expect(Session.create.mock.calls[0][0]).not.toBe(cookie);
});
test('CSRF is stable within the same session', async () => {
  const response = await api('get', '/csrf');
  expect(response.body.data.csrfToken).toBe(tokens.csrf(token));
  expect(Session.create).not.toHaveBeenCalled();
});
test.each(['/login', '/register'])('requires CSRF for %s', async (path) => {
  const response = await request(app).post('/api/v1/auth' + path).send({ email: user.email, password });
  expect(response.status).toBe(403);
  expect(Auth.findByEmail).not.toHaveBeenCalled();
  expect(Auth.register).not.toHaveBeenCalled();
});
test('rejects CSRF from another session', async () => {
  const response = await api('post', '/login').set('X-CSRF-Token', tokens.csrf('c'.repeat(64)))
    .send({ email: user.email, password });
  expect(response.status).toBe(403);
});
test('logs in and rotates session and CSRF; no bearer token or hash returned', async () => {
  validAccount();
  const response = await api('post', '/login').send({ email: ' EMPLOYEE@example.com ', password });
  expect(response.status).toBe(200);
  expect(Auth.findByEmail).toHaveBeenCalledWith(user.email);
  expect(Session.consume).toHaveBeenCalledWith(tokens.hash(token));
  expect(Session.create.mock.calls[0][0]).not.toBe(tokens.hash(token));
  expect(response.body.data.csrfToken).not.toBe(tokens.csrf(token));
  expect(response.body.data.user.id).toBe(user.public_id);
  expect(response.body.data.user).not.toHaveProperty('auth_version');
  expect(response.body.data).not.toHaveProperty('accessToken');
  expect(response.text).not.toContain('password_hash');
});
test('does not allow concurrent reuse of consumed login session', async () => {
  validAccount();
  Session.consume.mockResolvedValue(false);
  expect((await api('post', '/login').send({ email: user.email, password })).status).toBe(403);
  expect(Session.create).not.toHaveBeenCalled();
});
test.each(['missing', 'wrong', 'inactive'])('uses generic credential error: %s', async (kind) => {
  validAccount();
  if (kind === 'missing') Auth.findByEmail.mockResolvedValue(null);
  if (kind === 'inactive') Auth.findByEmail.mockResolvedValue({ ...user, password_hash: passwordHash, is_active: false });
  const response = await api('post', '/login').send({ email: user.email, password: kind === 'wrong' ? 'wrong-password' : password });
  expect(response.status).toBe(401);
  expect(response.body.message).toBe('Email, password, atau kode autentikasi salah');
  expect(Session.create).not.toHaveBeenCalled();
});
test('credentials changed during login do not issue a session', async () => {
  validAccount();
  Auth.markLogin.mockResolvedValue(null);
  expect((await api('post', '/login').send({ email: user.email, password })).status).toBe(401);
  expect(Session.create).not.toHaveBeenCalled();
});
test('enforces account throttling before bcrypt work', async () => {
  Throttle.increment.mockResolvedValueOnce({ attempts: 1, retry_after: 900 })
    .mockResolvedValueOnce({ attempts: 11, retry_after: 321 });
  const response = await api('post', '/login').send({ email: user.email, password });
  expect(response.status).toBe(429);
  expect(response.headers['retry-after']).toBe('321');
  expect(Auth.findByEmail).not.toHaveBeenCalled();
});
test('fails closed when throttle storage is unavailable', async () => {
  Throttle.increment.mockRejectedValue(new Error('database offline'));
  expect((await api('post', '/login').send({ email: user.email, password })).status).toBe(500);
  expect(Auth.findByEmail).not.toHaveBeenCalled();
});
test('register hashes the password and returns generic 202 without logging in', async () => {
  const response = await api('post', '/register').send({ email: user.email, password });
  expect(response.status).toBe(202);
  const data = Auth.register.mock.calls[0][0];
  expect(data.email).toBe(user.email);
  expect(await bcrypt.compare(password, data.passwordHash)).toBe(true);
  expect(data).not.toHaveProperty('role');
  expect(response.body).not.toHaveProperty('data');
  expect(Session.create).not.toHaveBeenCalled();
});
test('registration can be disabled', async () => {
  process.env.ENABLE_PUBLIC_REGISTRATION = 'false';
  expect((await api('post', '/register').send({ email: user.email, password })).status).toBe(403);
  expect(Auth.register).not.toHaveBeenCalled();
});
test.each([
  { email: 'employee@example.com', password: 'short' },
  { email: 'employee@example.com', password: 'é'.repeat(37) },
  { email: 'employee@example.com', password, role: 'HRD/Admin' },
  { email: 'employee@example.com', password, isActive: true },
])('rejects registration validation or privilege escalation', async (body) => {
  expect((await api('post', '/register').send(body)).status).toBe(422);
  expect(Auth.register).not.toHaveBeenCalled();
});
test('me returns public account fields from session lookup', async () => {
  Session.find.mockResolvedValue({ ...user, id: user.public_id, user_id: user.id, user_version: 1, token_hash: tokens.hash(token), created_at: new Date() });
  const response = await api('get', '/me');
  expect(response.status).toBe(200);
  expect(response.body.data.id).toBe(user.public_id);
  expect(response.text).not.toContain('auth_version');
});
test('logout revokes stored session and clears cookie', async () => {
  Session.find.mockResolvedValue({ ...user, id: user.public_id, user_id: user.id, user_version: 1, token_hash: tokens.hash(token) });
  const response = await api('post', '/logout').send({});
  expect(response.status).toBe(200);
  expect(Session.remove).toHaveBeenCalledWith(tokens.hash(token), user.public_id);
  expect(response.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
});
test('rejects hostile Origin and cross-site fetch requests', async () => {
  expect((await api('get', '/csrf').set('Origin', 'https://evil.example')).status).toBe(403);
  expect((await api('get', '/csrf').set('Sec-Fetch-Site', 'cross-site')).status).toBe(403);
});
test('rejects non-JSON mutation', async () => {
  expect((await api('post', '/login').type('form').send('email=x')).status).toBe(415);
});
test('limits JSON payload size', async () => {
  expect((await api('post', '/login').send({ password: 'a'.repeat(17000) })).status).toBe(413);
});
test('requires HTTPS in production', async () => {
  process.env.NODE_ENV = 'production';
  expect((await request(app).get('/api/v1/auth/csrf')).status).toBe(400);
});
test('production cookie uses Secure and __Host- prefix', () => {
  process.env.NODE_ENV = 'production';
  const config = require('../../config/auth');
  expect(config.cookieName()).toBe('__Host-hrd_session');
  expect(config.cookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
});
test('rejects insufficient secret configuration', async () => {
  process.env.SESSION_SECRET = 'short';
  expect((await request(app).get('/api/v1/auth/csrf')).status).toBe(503);
});
