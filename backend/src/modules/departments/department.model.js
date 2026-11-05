const pool = require('../../../config/database');
const transaction = require('../../shared/utils/transaction');
const HttpError = require('../../shared/utils/http-error');
const Audit = require('../audit/audit.model');

const publicColumns = 'public_id AS id, code, name, created_at, updated_at';

async function findAll({ page, limit, search }) {
  const keyword = `%${search.replace(/[\\%_]/g, (character) => '\\' + character)}%`;
  const count = await pool.query(
    `SELECT COUNT(*)::int AS total FROM "TB_DEPARTMENT"
     WHERE code ILIKE $1 OR name ILIKE $1`, [keyword],
  );
  const { rows } = await pool.query(
    `SELECT ${publicColumns} FROM "TB_DEPARTMENT"
     WHERE code ILIKE $1 OR name ILIKE $1
     ORDER BY code ASC LIMIT $2 OFFSET $3`,
    [keyword, limit, (page - 1) * limit],
  );
  return { departments: rows, total: count.rows[0].total };
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${publicColumns} FROM "TB_DEPARTMENT" WHERE public_id = $1`, [id],
  );
  return rows[0] || null;
}

async function verifyActor(client, actor) {
  if (!actor) throw new HttpError(403, 'Actor diperlukan');
  const { rows } = await client.query(
    `SELECT id FROM "TB_USERS" WHERE public_id = $1 AND auth_version = $2
     AND role = 'HRD/Admin' AND is_active = TRUE FOR SHARE`, [actor.id, actor.version],
  );
  if (!rows[0]) throw new HttpError(401, 'Hak akses berubah, login ulang');
}

async function create({ code, name }, actor) {
  return transaction(async (client) => {
    await verifyActor(client, actor);
    const { rows } = await client.query(
      `INSERT INTO "TB_DEPARTMENT" (code, name) VALUES ($1, $2) RETURNING ${publicColumns}`,
      [code, name],
    );
    await Audit.record('department.created', actor.id, rows[0].id, {}, client);
    return rows[0];
  }, actor?.id);
}

async function update(id, { code, name }, actor) {
  return transaction(async (client) => {
    await verifyActor(client, actor);
    const { rows } = await client.query(
      `UPDATE "TB_DEPARTMENT" SET code = COALESCE($1, code), name = COALESCE($2, name)
       WHERE public_id = $3 RETURNING ${publicColumns}`, [code ?? null, name ?? null, id],
    );
    if (!rows[0]) return null;
    await Audit.record('department.updated', actor.id, rows[0].id,
      { fields: [code !== undefined ? 'code' : null, name !== undefined ? 'name' : null].filter(Boolean) }, client);
    return rows[0];
  }, actor?.id);
}

module.exports = { findAll, findById, create, update };
