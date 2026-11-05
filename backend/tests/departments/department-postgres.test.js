jest.mock('pino-http', () => () => (req, res, next) => next());
const suite = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

suite('departments API with isolated PostgreSQL', () => {
  let database, pool, app, request, admin, employee, supervisor, department;
  const password = 'a-long-password-for-department-tests';
  beforeAll(async () => {
    process.env.SESSION_SECRET = 'department-test-session-secret-more-than-32-bytes';
    process.env.REQUIRE_ADMIN_MFA = 'false';
    database = await require('../helpers/database').createDatabase();
    pool = database.pool;
    app = require('../../src/app');
    request = require('supertest');
    const users = require('../../src/modules/users/user.service');
    async function account(email, role) {
      const user = await users.create({ email, password, role });
      const agent = request.agent(app);
      const initial = await agent.get('/api/v1/auth/csrf');
      const login = await agent.post('/api/v1/auth/login').set('X-CSRF-Token', initial.body.data.csrfToken).send({ email, password });
      expect(login.status).toBe(200);
      return { user, agent, csrf: login.body.data.csrfToken };
    }
    admin = await account('admin@department.example.com', 'HRD/Admin');
    employee = await account('employee@department.example.com', 'Employee');
    supervisor = await account('supervisor@department.example.com', 'Supervisor');
    const seed = require('../../database/seeds/department.seed');
    await seed(pool);
    await seed(pool);
    const created = await write('post', '', { code: ' qa ', name: ' Quality Assurance ' });
    expect(created.status).toBe(201);
    department = created.body.data;
  });
  afterAll(async () => { await database?.cleanup(); });
  function write(method, path, body, actor = admin) {
    return actor.agent[method](`/api/v1/departments${path}`).set('X-CSRF-Token', actor.csrf).send(body);
  }
  test('seed can be repeated without duplicate departments', async () => {
    const { rows } = await pool.query(`SELECT code FROM "TB_DEPARTMENT" WHERE code IN ('OPS', 'HRD')`);
    expect(rows).toHaveLength(2);
  });
  test('creates a normalized department with public UUID', () => {
    expect(department.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(department.code).toBe('QA');
    expect(department.name).toBe('Quality Assurance');
    expect(department).not.toHaveProperty('public_id');
  });
  test('requires authentication', async () => {
    expect((await request(app).get('/api/v1/departments')).status).toBe(401);
  });
  test.each(['employee', 'supervisor'])('%s can read departments', async (role) => {
    const actor = role === 'employee' ? employee : supervisor;
    const list = await actor.agent.get('/api/v1/departments?page=1&limit=2');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect((await actor.agent.get(`/api/v1/departments/${department.id}`)).status).toBe(200);
  });
  test.each(['employee', 'supervisor'])('%s cannot create or update', async (role) => {
    const actor = role === 'employee' ? employee : supervisor;
    expect((await write('post', '', { code: 'NO', name: 'Forbidden' }, actor)).status).toBe(403);
    expect((await write('patch', `/${department.id}`, { name: 'Forbidden' }, actor)).status).toBe(403);
  });
  test('admin requires MFA when policy is enabled', async () => {
    process.env.REQUIRE_ADMIN_MFA = 'true';
    try { expect((await admin.agent.get('/api/v1/departments')).status).toBe(403); }
    finally { process.env.REQUIRE_ADMIN_MFA = 'false'; }
  });
  test('requires CSRF on mutations', async () => {
    expect((await admin.agent.post('/api/v1/departments').send({ code: 'CSRF', name: 'Invalid' })).status).toBe(403);
  });
  test('requires recent authentication on mutations', async () => {
    await pool.query(`UPDATE "TB_SESSIONS" SET verified_at = CURRENT_TIMESTAMP - INTERVAL '6 minutes'
      WHERE user_id = (SELECT id FROM "TB_USERS" WHERE public_id = $1)`, [admin.user.id]);
    expect((await write('patch', `/${department.id}`, { name: 'Denied' })).status).toBe(401);
    await pool.query(`UPDATE "TB_SESSIONS" SET verified_at = CURRENT_TIMESTAMP
      WHERE user_id = (SELECT id FROM "TB_USERS" WHERE public_id = $1)`, [admin.user.id]);
  });
  test('search matches a substring of code or name, ignoring case', async () => {
    const response = await employee.agent.get('/api/v1/departments?search=assur');
    expect(response.status).toBe(200);
    expect(response.body.data.map((row) => row.id)).toEqual([department.id]);
    expect((await employee.agent.get('/api/v1/departments?search=ps')).body.data[0].code).toBe('OPS');
  });
  test('search escapes percent, underscore, backslash and SQL injection text', async () => {
    for (const search of ['%', '_', '\\', "' OR 1=1 --"]) {
      const response = await employee.agent.get('/api/v1/departments').query({ search });
      expect(response.status).toBe(200);
      expect(response.body.pagination.total).toBe(0);
    }
  });
  test('returns an empty page with a correct total', async () => {
    const response = await employee.agent.get('/api/v1/departments?page=9&limit=2');
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.total).toBe(3);
  });
  test('supports partial update and updates the timestamp', async () => {
    const response = await write('patch', `/${department.id.toUpperCase()}`, { name: 'Quality Control' });
    expect(response.status).toBe(200);
    expect(response.body.data.code).toBe('QA');
    expect(response.body.data.name).toBe('Quality Control');
    expect(new Date(response.body.data.updated_at).getTime()).toBeGreaterThan(new Date(department.updated_at).getTime());
  });
  test('duplicate code returns 409 and keeps the data unchanged', async () => {
    expect((await write('post', '', { code: 'qa', name: 'Duplicate' })).body)
      .toMatchObject({ success: false, message: 'Kode departemen sudah digunakan' });
    expect((await write('patch', `/${department.id}`, { code: 'ops' })).status).toBe(409);
    expect((await employee.agent.get(`/api/v1/departments/${department.id}`)).body.data.code).toBe('QA');
  });
  test.each([
    {}, { code: ' ', name: 'Valid' }, { code: 'A'.repeat(21), name: 'Valid' },
    { code: 'VALID', name: ' ' }, { code: 'VALID', name: 'A'.repeat(101) },
    { code: 'VALID', name: 'Valid', id: 'unexpected' },
  ])('rejects invalid create input', async (body) => {
    expect((await write('post', '', body)).status).toBe(422);
  });
  test.each([{}, { name: null }, { isActive: true }])('rejects invalid update input', async (body) => {
    expect((await write('patch', `/${department.id}`, body)).status).toBe(422);
  });
  test.each(['/1', '?limit=101', '?page=0', '?unknown=x'])('rejects invalid params or query %s', async (path) => {
    expect((await employee.agent.get(`/api/v1/departments${path}`)).status).toBe(422);
  });
  test('returns 404 for missing UUID on read and update', async () => {
    const id = require('node:crypto').randomUUID();
    expect((await employee.agent.get(`/api/v1/departments/${id}`)).status).toBe(404);
    expect((await write('patch', `/${id}`, { name: 'Missing' })).status).toBe(404);
  });
  test('writes audit with actor inside the same transaction', async () => {
    const { rows } = await pool.query('SELECT action, actor_public_id, details FROM "TB_AUDIT_LOGS" WHERE subject_public_id = $1 ORDER BY id', [department.id]);
    expect(rows.map((row) => row.action)).toEqual(['department.created', 'department.updated']);
    expect(rows.every((row) => row.actor_public_id === admin.user.id)).toBe(true);
    expect(rows[1].details).toEqual({ fields: ['name'] });
  });
  test('rechecks actor permissions/version before writing', async () => {
    const model = require('../../src/modules/departments/department.model');
    await expect(model.create({ code: 'STALE', name: 'Stale' }, { id: admin.user.id, version: -1 }))
      .rejects.toMatchObject({ status: 401 });
    expect((await employee.agent.get('/api/v1/departments?search=STALE')).body.data).toEqual([]);
  });
});
