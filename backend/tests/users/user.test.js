jest.mock('../../config/database', () => ({ query: jest.fn() }));

const bcrypt = require('bcrypt');
const pool = require('../../config/database');
const User = require('../../src/modules/users/user.service');

beforeEach(() => jest.clearAllMocks());

test('create normalizes email and stores a bcrypt hash', async () => {
  const user = { id: '1', email: 'andi@example.com', role: 'Employee' };
  pool.query.mockResolvedValue({ rows: [user] });

  expect(await User.create({ email: ' Andi@example.com ', password: 'a-long-password-123' })).toEqual(user);
  const [sql, values] = pool.query.mock.calls[0];
  expect(sql).toContain('INSERT INTO "TB_USERS"');
  expect(values[0]).toBe('andi@example.com');
  expect(await bcrypt.compare('a-long-password-123', values[1])).toBe(true);
  expect(values[2]).toBe('Employee');
  expect(sql.split('RETURNING')[1]).not.toContain('password_hash');
});

test.each([
  { email: 'invalid', password: 'a-long-password-123' },
  { email: 'andi@example.com', password: 'short' },
  { email: 'andi@example.com', password: 'é'.repeat(37) },
  { email: 'andi@example.com', password: 'a-long-password-123', role: 'Admin' },
  { email: 'andi@example.com', password: 'a-long-password-123', is_active: true },
])('rejects invalid creation input before querying', async (input) => {
  await expect(User.create(input)).rejects.toThrow();
  expect(pool.query).not.toHaveBeenCalled();
});

test('getById reports a missing account and excludes password hash', async () => {
  pool.query.mockResolvedValue({ rows: [] });
  await expect(User.getById('11111111-1111-4111-8111-111111111111')).rejects.toMatchObject({ status: 404 });
  expect(pool.query.mock.calls[0][0]).not.toContain('password_hash');
});

test('rejects invalid IDs before querying', async () => {
  await expect(User.getById('1 OR 1=1')).rejects.toThrow();
  expect(pool.query).not.toHaveBeenCalled();
});
