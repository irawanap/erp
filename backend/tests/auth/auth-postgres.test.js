// Opt-in integration test against the migrated local database; generated accounts are removed.
const enabled = process.env.RUN_DB_TESTS === '1';
const suite = enabled ? describe : describe.skip;
jest.mock('pino-http', () => () => (req, res, next) => next());

suite('authentication with PostgreSQL', () => {
  let pool;
  let database;
  let app;
  let request;
  const { randomUUID } = require('node:crypto');
  const email = `integration.${randomUUID()}@example.com`;
  const password = 'integration-long-password-123';
  let userId;
  beforeAll(async () => {
    process.env.SESSION_SECRET = 'integration-test-session-secret-32-bytes';
    process.env.ENABLE_PUBLIC_REGISTRATION = 'true';
    database = await require('../helpers/database').createDatabase();
    pool = database.pool;
    app = require('../../src/app');
    request = require('supertest');
  });
  afterAll(async () => {
    await database?.cleanup();
  });

  test('registration, CSRF, rotation, session expiry, revocation and logout', async () => {
    const client = request.agent(app);
    const initial = await client.get('/api/v1/auth/csrf');
    expect(initial.status).toBe(200);
    const initialCookie = initial.headers['set-cookie'][0].split(';')[0];
    const csrf = initial.body.data.csrfToken;
    expect((await client.post('/api/v1/auth/register').send({ email, password })).status).toBe(403);
    expect((await client.post('/api/v1/auth/register').set('X-CSRF-Token', csrf)
      .send({ email, password, role: 'HRD/Admin' })).status).toBe(422);
    const registered = await client.post('/api/v1/auth/register').set('X-CSRF-Token', csrf).send({ email, password });
    expect(registered.status).toBe(202);
    const duplicate = await client.post('/api/v1/auth/register').set('X-CSRF-Token', csrf).send({ email, password });
    expect(duplicate.body).toEqual(registered.body);
    const { rows: accounts } = await pool.query('SELECT * FROM "TB_USERS" WHERE email = $1', [email]);
    expect(accounts).toHaveLength(1);
    userId = accounts[0].id;
    expect(accounts[0].role).toBe('Employee');
    expect(accounts[0].password_hash).not.toBe(password);

    const login = await client.post('/api/v1/auth/login').set('X-CSRF-Token', csrf).send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.data.user).not.toHaveProperty('password_hash');
    expect(login.headers['set-cookie'][0].split(';')[0]).not.toBe(initialCookie);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', initialCookie)).status).toBe(401);
    expect((await client.get('/api/v1/auth/me')).body.data.id).toBe(accounts[0].public_id);
    expect((await client.get('/api/v1/users')).status).toBe(403);
    expect((await client.post('/api/v1/auth/logout').set('X-CSRF-Token', csrf).send({})).status).toBe(403);
    const loginCookie = login.headers['set-cookie'][0].split(';')[0];
    expect((await client.post('/api/v1/auth/logout')
      .set('X-CSRF-Token', login.body.data.csrfToken).send({})).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', loginCookie)).status).toBe(401);

    async function signIn() {
      const response = await client.get('/api/v1/auth/csrf');
      const result = await client.post('/api/v1/auth/login').set('X-CSRF-Token', response.body.data.csrfToken)
        .send({ email, password });
      expect(result.status).toBe(200);
      return result;
    }
    await signIn();
    await pool.query('UPDATE "TB_SESSIONS" SET last_seen_at = CURRENT_TIMESTAMP - INTERVAL \'31 minutes\' WHERE user_id = $1', [userId]);
    expect((await client.get('/api/v1/auth/me')).status).toBe(401);
    await signIn();
    await pool.query('UPDATE "TB_SESSIONS" SET expires_at = CURRENT_TIMESTAMP - INTERVAL \'1 second\' WHERE user_id = $1', [userId]);
    expect((await client.get('/api/v1/auth/me')).status).toBe(401);
    await signIn();
    await pool.query('UPDATE "TB_USERS" SET role = \'Supervisor\' WHERE id = $1', [userId]);
    expect((await client.get('/api/v1/auth/me')).status).toBe(401);
    expect((await pool.query('SELECT * FROM "TB_SESSIONS" WHERE user_id = $1', [userId])).rows).toHaveLength(0);
    await signIn();
    const newHash = await require('bcrypt').hash(password, 12);
    await pool.query('UPDATE "TB_USERS" SET password_hash = $1 WHERE id = $2', [newHash, userId]);
    expect((await client.get('/api/v1/auth/me')).status).toBe(401);
    await signIn();
    await pool.query('UPDATE "TB_USERS" SET email = $1 WHERE id = $2', [email.replace('integration.', 'changed.'), userId]);
    expect((await client.get('/api/v1/auth/me')).status).toBe(401);
    await pool.query('UPDATE "TB_USERS" SET email = $1 WHERE id = $2', [email, userId]);
    await signIn();
    await pool.query('UPDATE "TB_USERS" SET is_active = FALSE WHERE id = $1', [userId]);
    expect((await client.get('/api/v1/auth/me')).status).toBe(401);
  }, 20000);

  test('shared throttle increments atomically across concurrent requests', async () => {
    const key = require('node:crypto').randomBytes(32).toString('hex');
    const throttle = require('../../src/modules/auth/auth-throttle.model');
    try {
      const results = await Promise.all(Array.from({ length: 12 }, () => throttle.increment(key, 900)));
      expect(results.map((value) => value.attempts).sort((a, b) => a - b))
        .toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
      expect(results.every((value) => value.retry_after > 0 && value.retry_after <= 900)).toBe(true);
    } finally {
      await pool.query('DELETE FROM "TB_AUTH_THROTTLES" WHERE key_hash = $1', [key]);
    }
  });
});
