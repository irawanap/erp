const pool = require('../../../config/database');

async function record(action, actorId = null, subjectId = null, details = {}, db = pool) {
  await db.query(
    `INSERT INTO "TB_AUDIT_LOGS" (actor_public_id, subject_public_id, action, details)
     VALUES ($1, $2, $3, $4)`, [actorId, subjectId, action, JSON.stringify(details)],
  );
}

async function list({ page, limit }) {
  const count = await pool.query('SELECT COUNT(*)::int AS total FROM "TB_AUDIT_LOGS"');
  const { rows } = await pool.query(
    `SELECT public_id AS id, actor_public_id, subject_public_id, action, details, created_at
     FROM "TB_AUDIT_LOGS" ORDER BY created_at DESC, "TB_AUDIT_LOGS".id DESC LIMIT $1 OFFSET $2`,
    [limit, (page - 1) * limit],
  );
  return { data: rows, pagination: { page, limit, total: count.rows[0].total, totalPages: Math.ceil(count.rows[0].total / limit) } };
}

module.exports = { record, list };
