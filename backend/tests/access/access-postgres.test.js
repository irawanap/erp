jest.mock('pino-http', () => () => (req, res, next) => next());
const suite = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
suite('access hardening with isolated PostgreSQL', () => {
  let database, pool, app, request, admin, employee, client, csrf;
  const password = 'a-strong-password-for-testing';
  const adminEmail = 'admin@isolated.example.com';
  const employeeEmail = 'employee@isolated.example.com';
  beforeAll(async () => {
    process.env.SESSION_SECRET = 'integration-session-secret-at-least-32-bytes';
    process.env.MFA_ENCRYPTION_KEY = 'b'.repeat(64);
    process.env.REQUIRE_ADMIN_MFA = 'false';
    database = await require('../helpers/database').createDatabase();
    pool = database.pool;
    app = require('../../src/app');
    request = require('supertest');
    const users = require('../../src/modules/users/user.service');
    admin = await users.create({ email: adminEmail, password, role: 'HRD/Admin' });
    employee = await users.create({ email: employeeEmail, password });
    client = request.agent(app);
    const initial = await client.get('/api/v1/auth/csrf');
    const login = await client.post('/api/v1/auth/login').set('X-CSRF-Token', initial.body.data.csrfToken)
      .send({ email: adminEmail, password });
    expect(login.status).toBe(200);
    csrf = login.body.data.csrfToken;
  });
  afterAll(async () => { await database?.cleanup(); });
  function mutate(method, path, body = {}) {
    return client[method](path).set('X-CSRF-Token', csrf).send(body);
  }
  test('all outward account IDs are UUIDs, and numeric paths are rejected', async () => {
    expect(admin.id).toMatch(/^[a-f0-9-]{36}$/);
    expect((await client.get(`/api/v1/users/${employee.id}`)).body.data.id).toBe(employee.id);
    expect((await client.get('/api/v1/users/1')).status).toBe(422);
    const me = await client.get('/api/v1/auth/me');
    expect(me.body.data.id).toBe(admin.id);
    expect(me.body.data).not.toHaveProperty('auth_version');
    expect(me.body.data).not.toHaveProperty('public_id');
  });
  test('self-demotion and self-deactivation are blocked, including uppercase UUIDs', async () => {
    expect((await mutate('patch', `/api/v1/users/${admin.id.toUpperCase()}`, { role: 'Employee' })).status).toBe(403);
    expect((await mutate('delete', `/api/v1/users/${admin.id}`)).status).toBe(403);
  });
  test('database protects the last admin even outside API', async () => {
    await expect(pool.query('UPDATE "TB_USERS" SET is_active = FALSE WHERE public_id = $1', [admin.id]))
      .rejects.toMatchObject({ constraint: 'tb_users_last_admin' });
  });
  test('user changes record actor and do not record passwords or email values', async () => {
    const response = await mutate('patch', `/api/v1/users/${employee.id}`, { role: 'Supervisor' });
    expect(response.status).toBe(200);
    const audit = await pool.query(`SELECT * FROM "TB_AUDIT_LOGS" WHERE subject_public_id = $1 AND action = 'user.updated'`, [employee.id]);
    expect(audit.rows[0].actor_public_id).toBe(admin.id);
    expect(audit.rows[0].details.roleChanged).toBe(true);
    expect(JSON.stringify(audit.rows)).not.toContain(password);
    expect(JSON.stringify(audit.rows)).not.toContain(employeeEmail);
    await expect(pool.query('DELETE FROM "TB_AUDIT_LOGS" WHERE public_id = $1', [audit.rows[0].public_id])).rejects.toMatchObject({ code: '23514' });
  });
  test('roles and audit logs require permitted role', async () => {
    expect((await client.get('/api/v1/roles')).status).toBe(200);
    expect((await client.get('/api/v1/audit-logs')).status).toBe(200);
  });
  test('MFA setup, OTP replay, recovery codes, password change and logout all', async () => {
    const agent = request.agent(app);
    const first = await agent.get('/api/v1/auth/csrf');
    let currentCsrf = first.body.data.csrfToken;
    const signedIn = await agent.post('/api/v1/auth/login').set('X-CSRF-Token', currentCsrf).send({ email: employeeEmail, password });
    currentCsrf = signedIn.body.data.csrfToken;
    const setup = await agent.post('/api/v1/auth/mfa/setup').set('X-CSRF-Token', currentCsrf).send({ currentPassword: password });
    expect(setup.status).toBe(200);
    const OTPAuth = require('otpauth');
    const totp = new OTPAuth.TOTP({ secret: setup.body.data.secret });
    const confirmed = await agent.post('/api/v1/auth/mfa/confirm').set('X-CSRF-Token', currentCsrf).send({ otp: totp.generate() });
    expect(confirmed.status).toBe(200);
    const codes = confirmed.body.data.recoveryCodes;
    expect(codes).toHaveLength(8);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    const internal = await require('../../src/modules/auth/auth.model').findByEmail(employeeEmail);
    const stored = await require('../../src/modules/auth/mfa.model').find(internal.id);
    expect(stored.encrypted_secret).not.toContain(setup.body.data.secret);
    expect(stored.recovery_hashes).not.toContain(codes[0]);

    async function login(body) {
      const before = await agent.get('/api/v1/auth/csrf');
      const response = await agent.post('/api/v1/auth/login').set('X-CSRF-Token', before.body.data.csrfToken)
        .send({ email: employeeEmail, password, ...body });
      if (response.status === 200) currentCsrf = response.body.data.csrfToken;
      return response;
    }
    expect((await login({})).status).toBe(401);
    const otp = totp.generate({ timestamp: Date.now() + 30000 });
    expect((await login({ otp })).status).toBe(200);
    expect((await login({ otp })).status).toBe(401);
    const sessions = await agent.get('/api/v1/auth/sessions');
    expect(sessions.status).toBe(200);
    expect(sessions.body.data[0].id).toMatch(/^[a-f0-9-]{36}$/);
    expect(sessions.text).not.toContain('token_hash');
    // A user's session ID cannot be revoked through another user's endpoint.
    expect((await mutate('delete', `/api/v1/auth/sessions/${sessions.body.data[0].id}`)).status).toBe(404);

    const reauth = await agent.post('/api/v1/auth/reauthenticate').set('X-CSRF-Token', currentCsrf)
      .send({ currentPassword: password, recoveryCode: codes[0] });
    expect(reauth.status).toBe(200);
    currentCsrf = reauth.body.data.csrfToken;
    expect((await agent.post('/api/v1/auth/reauthenticate').set('X-CSRF-Token', currentCsrf)
      .send({ currentPassword: password, recoveryCode: codes[0] })).status).toBe(401);
    const changed = await agent.post('/api/v1/auth/change-password').set('X-CSRF-Token', currentCsrf)
      .send({ currentPassword: password, newPassword: 'a-new-strong-password-for-tests', recoveryCode: codes[1] });
    expect(changed.status).toBe(200);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    const relogin = await login({ password: 'a-new-strong-password-for-tests', recoveryCode: codes[2] });
    expect(relogin.status).toBe(200);
    expect((await agent.post('/api/v1/auth/logout-all').set('X-CSRF-Token', currentCsrf).send({})).status).toBe(200);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect((await login({ password: 'a-new-strong-password-for-tests', recoveryCode: codes[3] })).status).toBe(200);
    const disabled = await agent.post('/api/v1/auth/mfa/disable').set('X-CSRF-Token', currentCsrf)
      .send({ currentPassword: 'a-new-strong-password-for-tests', recoveryCode: codes[4] });
    expect(disabled.status).toBe(200);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect(await require('../../src/modules/auth/mfa.model').find(internal.id)).toBeNull();
  }, 20000);
  test('caps sessions and rejects stale actor authorization', async () => {
    const auth = require('../../src/modules/auth/auth.model');
    const user = await auth.findByEmail(adminEmail);
    const sessions = require('../../src/modules/auth/session.model');
    const tokens = require('../../src/modules/auth/session-token');
    await Promise.all(Array.from({ length: 7 }, () => sessions.create(tokens.hash(tokens.generate()), user)));
    const count = await pool.query('SELECT COUNT(*)::int AS total FROM "TB_SESSIONS" WHERE user_id = $1', [user.id]);
    expect(count.rows[0].total).toBe(5);
    await expect(require('../../src/modules/users/user.model').update(employee.id, { role: 'Employee' }, { id: admin.id, version: -1 }))
      .rejects.toMatchObject({ status: 401 });
  });
  test('concurrent cross-admin demotions revalidate actor after locking', async () => {
    const users = require('../../src/modules/users/user.service');
    const a = await users.create({ email: 'admin-a@isolated.example.com', password, role: 'HRD/Admin' });
    const b = await users.create({ email: 'admin-b@isolated.example.com', password, role: 'HRD/Admin' });
    const model = require('../../src/modules/users/user.model');
    const results = await Promise.allSettled([
      model.update(b.id, { role: 'Employee' }, { id: a.id, version: 1 }),
      model.update(a.id, { role: 'Employee' }, { id: b.id, version: 1 }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected').reason.status).toBe(401);
  });

});
