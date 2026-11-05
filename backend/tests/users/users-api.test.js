jest.mock('../../config/database', () => ({ query: jest.fn() }));
jest.mock('../../src/modules/users/user.model');
jest.mock('../../src/modules/audit/audit.model', () => ({ record: jest.fn() }));
jest.mock('../../src/modules/auth/session.model', () => ({ find: jest.fn(), touch: jest.fn() }));
jest.mock('pino-http', () => () => (req, res, next) => next());
const request = require('supertest');
const User = require('../../src/modules/users/user.model');
const Session = require('../../src/modules/auth/session.model');
const tokens = require('../../src/modules/auth/session-token');
const app = require('../../src/app');
const id = '11111111-1111-4111-8111-111111111111';
const target = '22222222-2222-4222-8222-222222222222';
const token = 'a'.repeat(64);
let session;
beforeEach(() => {
  jest.resetAllMocks();
  process.env.SESSION_SECRET = 'test-secret-with-at-least-32-bytes-long';
  process.env.REQUIRE_ADMIN_MFA = 'false';
  session = { id, user_id: '1', user_version: 1, email: 'admin@example.com', role: 'HRD/Admin',
    is_active: true, token_hash: tokens.hash(token), verified_at: new Date(), mfa_verified: true };
  Session.find.mockImplementation(async () => session);
});
function api(method, path = '') {
  return request(app)[method](`/api/v1/users${path}`)
    .set('Cookie', `hrd_session=${token}`).set('X-CSRF-Token', tokens.csrf(token))
    .set('Content-Type', 'application/json');
}
test('does not accept legacy bearer tokens', async () => {
  expect((await request(app).get('/api/v1/users').set('Authorization', 'Bearer old-token')).status).toBe(401);
});
test('rejects revoked sessions', async () => {
  session = null;
  expect((await api('get')).status).toBe(401);
});
test.each(['Employee', 'Supervisor', 'Unknown', 'toString'])('denies users access for role %s', async (role) => {
  session.role = role;
  expect((await api('get')).status).toBe(403);
  expect(User.findAll).not.toHaveBeenCalled();
});
test('requires enrolled MFA when admin policy is enabled', async () => {
  process.env.REQUIRE_ADMIN_MFA = 'true';
  session.mfa_verified = false;
  expect((await api('get')).status).toBe(403);
});
test('requires recent authentication for mutations', async () => {
  session.verified_at = new Date(Date.now() - 6 * 60000);
  expect((await api('patch', `/${target}`).send({ role: 'Employee' })).status).toBe(401);
  expect(User.update).not.toHaveBeenCalled();
});
test('requires CSRF', async () => {
  expect((await request(app).post('/api/v1/users').set('Cookie', `hrd_session=${token}`).send({})).status).toBe(403);
});
test('creates a user with actor identity and hashed password', async () => {
  User.create.mockResolvedValue({ id: target, email: 'new@example.com', role: 'Employee' });
  const response = await api('post').send({ email: 'NEW@example.com', password: 'a-long-password-123' });
  expect(response.status).toBe(201);
  const [data, actor] = User.create.mock.calls[0];
  expect(actor).toEqual({ id, version: 1 });
  expect(data.email).toBe('new@example.com');
  expect(await require('bcrypt').compare('a-long-password-123', data.passwordHash)).toBe(true);
  expect(response.text).not.toContain('passwordHash');
});
test('rejects invalid body', async () => {
  expect((await api('post').send({ email: 'invalid', password: 'short' })).status).toBe(422);
  expect(User.create).not.toHaveBeenCalled();
});
test('returns conflict for duplicate email', async () => {
  User.create.mockRejectedValue(Object.assign(new Error('private'), { code: '23505' }));
  expect((await api('post').send({ email: 'new@example.com', password: 'a-long-password-123' })).status).toBe(409);
});
test('lists users with validated filters', async () => {
  User.findAll.mockResolvedValue({ users: [{ id: target }], total: 11 });
  const response = await api('get', '?page=2&limit=10&isActive=true');
  expect(response.status).toBe(200);
  expect(response.body.pagination.totalPages).toBe(2);
  expect(User.findAll).toHaveBeenCalledWith({ page: 2, limit: 10, search: '', isActive: true });
});
test.each(['/1', '/0', '/9223372036854775808', '?limit=101'])('rejects numeric ID or invalid pagination %s', async (path) => {
  expect((await api('get', path)).status).toBe(422);
});
test('uses public UUID for details', async () => {
  User.findById.mockResolvedValue({ id: target });
  expect((await api('get', `/${target}`)).body.data.id).toBe(target);
});
test('returns 404 for a missing UUID', async () => {
  User.findById.mockResolvedValue(null);
  expect((await api('get', `/${target}`)).status).toBe(404);
});
test.each([{}, { passwordHash: 'plain' }, { employeeId: '1' }])('rejects unsupported updates', async (body) => {
  expect((await api('patch', `/${target}`).send(body)).status).toBe(422);
});
test('passes actor version to user updates', async () => {
  User.update.mockResolvedValue({ id: target });
  expect((await api('patch', `/${target}`).send({ role: 'Supervisor' })).status).toBe(200);
  expect(User.update).toHaveBeenCalledWith(target, { role: 'Supervisor' }, { id, version: 1 });
});
test('deactivates via DELETE', async () => {
  User.update.mockResolvedValue({ id: target, is_active: false });
  expect((await api('delete', `/${target}`)).body.data.is_active).toBe(false);
  expect(User.update).toHaveBeenCalledWith(target, { isActive: false }, { id, version: 1 });
});
test('does not reveal internal errors', async () => {
  User.findById.mockRejectedValue(new Error('private database detail'));
  const response = await api('get', `/${target}`);
  expect(response.status).toBe(500);
  expect(response.text).not.toContain('private');
});
