const pool = require('../../../config/database');
const transaction = require('../../shared/utils/transaction');
const HttpError = require('../../shared/utils/http-error');

const publicColumns = `public_id AS id, (SELECT e.public_id FROM "TB_EMPLOYEES" e WHERE e.id="TB_USERS".employee_id) AS employee_id, email, role, is_active,
  last_login_at, created_at, updated_at`;

async function create({ email, passwordHash, role }, actor) {
  if (actor) return transaction(async (client) => {
    await lockAdmin(client, actor);
    return insert(client, { email, passwordHash, role });
  }, actor.id);
  return insert(pool, { email, passwordHash, role });
}

async function insert(db, { email, passwordHash, role }) {
  const { rows } = await db.query(
    `INSERT INTO "TB_USERS" (email, password_hash, role)
     VALUES ($1, $2, $3) RETURNING ${publicColumns}`,
    [email, passwordHash, role],
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${publicColumns} FROM "TB_USERS" WHERE public_id = $1`, [id],
  );
  return rows[0] || null;
}

async function findAll({ page, limit, search, role, isActive }) {
  const values = [];
  const conditions = [];
  if (search) {
    values.push(`%${search.replace(/[\\%_]/g, (character) => '\\' + character)}%`);
    conditions.push(`email ILIKE $${values.length}`);
  }
  if (role !== undefined) {
    values.push(role);
    conditions.push(`role = $${values.length}`);
  }
  if (isActive !== undefined) {
    values.push(isActive);
    conditions.push(`is_active = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM "TB_USERS" ${where}`, values);
  const { rows } = await pool.query(
    `SELECT ${publicColumns} FROM "TB_USERS" ${where}
     ORDER BY "TB_USERS".id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit],
  );
  return { users: rows, total: count.rows[0].total };
}

async function lockAdmin(client, actor) {
  if (!actor) throw new HttpError(403, 'Actor diperlukan');
  await client.query('SELECT pg_advisory_xact_lock(73188001)');
  const { rows } = await client.query(
    `SELECT id FROM "TB_USERS" WHERE public_id = $1 AND auth_version = $2
     AND role = 'HRD/Admin' AND is_active = TRUE FOR UPDATE`, [actor.id, actor.version],
  );
  if (!rows[0]) throw new HttpError(401, 'Hak akses berubah, login ulang');
}

async function update(id, input, actor) {
  return transaction(async (client) => {
    await lockAdmin(client, actor);
    const current = await client.query('SELECT role, is_active FROM "TB_USERS" WHERE public_id = $1 FOR UPDATE', [id]);
    if (!current.rows[0]) return null;
    if (actor.id === id && (input.role !== undefined || input.isActive === false)) {
      throw new HttpError(403, 'Tidak boleh mengubah role atau menonaktifkan akun sendiri');
    }
    if (current.rows[0].role === 'HRD/Admin' && current.rows[0].is_active
        && ((input.role !== undefined && input.role !== 'HRD/Admin') || input.isActive === false)) {
      const admins = await client.query(`SELECT COUNT(*)::int AS total FROM "TB_USERS" WHERE role = 'HRD/Admin' AND is_active = TRUE`);
      if (admins.rows[0].total <= 1) throw new HttpError(409, 'Admin aktif terakhir harus dipertahankan');
    }
    const columns = { email: 'email', passwordHash: 'password_hash', role: 'role', isActive: 'is_active' };
    const entries = Object.entries(input).filter(([key]) => Object.hasOwn(columns, key));
    const assignments = entries.map(([key], index) => `${columns[key]} = $${index + 1}`);
    const values = entries.map(([, value]) => value);
    const { rows } = await client.query(
      `UPDATE "TB_USERS" SET ${assignments.join(', ')}
       WHERE public_id = $${values.length + 1} RETURNING ${publicColumns}`, [...values, id],
    );
    return rows[0] || null;
  }, actor?.id);
}

module.exports = { create, findById, findAll, update };
