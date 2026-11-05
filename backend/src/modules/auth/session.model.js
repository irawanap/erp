const pool = require('../../../config/database');
const transaction = require('../../shared/utils/transaction');
const Audit = require('../audit/audit.model');
const HttpError = require('../../shared/utils/http-error');

async function create(tokenHash, user = null) {
  const lifetime = user ? 7200 : 900;
  const insert = async (db) => {
    const { rows } = await db.query(
      `INSERT INTO "TB_SESSIONS" (token_hash, user_id, user_version, expires_at, mfa_verified)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP + $4 * INTERVAL '1 second', $5) RETURNING expires_at`,
      [tokenHash, user?.id || null, user?.auth_version ?? null, lifetime, user?.mfa_verified === true],
    );
    return rows[0];
  };
  if (!user) return insert(pool);
  return transaction(async (client) => {
    const account = await client.query(
      'SELECT id FROM "TB_USERS" WHERE id = $1 AND auth_version = $2 AND is_active = TRUE FOR UPDATE', [user.id, user.auth_version],
    );
    if (!account.rows[0]) throw new HttpError(401, 'Kredensial berubah, login ulang');
    const result = await insert(client);
    const evicted = await client.query(
      `DELETE FROM "TB_SESSIONS" WHERE user_id = $1 AND token_hash IN (
       SELECT token_hash FROM "TB_SESSIONS" WHERE user_id = $1
       ORDER BY (token_hash = $2) DESC, created_at DESC, token_hash DESC OFFSET 5)`, [user.id, tokenHash],
    );
    await Audit.record('session.created', user.public_id, user.public_id, { evicted: evicted.rowCount }, client);
    return result;
  });
}

async function find(tokenHash) {
  const { rows } = await pool.query(
    `SELECT s.token_hash, s.public_id AS session_id, s.user_id, s.user_version, s.verified_at, s.mfa_verified, s.created_at, s.expires_at,
            u.public_id AS id, u.employee_id, e.public_id AS employee_public_id, u.email, u.role, u.is_active,
            u.last_login_at, u.created_at AS user_created_at, u.updated_at
     FROM "TB_SESSIONS" s
     LEFT JOIN "TB_USERS" u ON u.id = s.user_id
     LEFT JOIN "TB_EMPLOYEES" e ON e.id = u.employee_id
     WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP
       AND s.last_seen_at > CURRENT_TIMESTAMP - INTERVAL '30 minutes'
       AND (s.user_id IS NULL OR (u.is_active = TRUE AND u.auth_version = s.user_version AND (u.employee_id IS NULL OR e.employment_status='Active')))`,
    [tokenHash],
  );
  return rows[0] || null;
}

async function touch(tokenHash) {
  await pool.query(`UPDATE "TB_SESSIONS" SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = $1`, [tokenHash]);
}

async function remove(tokenHash, actorId) {
  await transaction(async (client) => {
    await client.query('DELETE FROM "TB_SESSIONS" WHERE token_hash = $1', [tokenHash]);
    await Audit.record('auth.logout', actorId, actorId, {}, client);
  }, actorId);
}

async function consume(tokenHash) {
  const { rowCount } = await pool.query(
    `DELETE FROM "TB_SESSIONS" WHERE token_hash = $1
     AND expires_at > CURRENT_TIMESTAMP
     AND last_seen_at > CURRENT_TIMESTAMP - INTERVAL '30 minutes'`, [tokenHash],
  );
  return rowCount === 1;
}

async function list(userId, currentHash) {
  const { rows } = await pool.query(
    `SELECT public_id AS id, created_at, last_seen_at, expires_at, (token_hash = $2) AS is_current
     FROM "TB_SESSIONS" WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
     AND last_seen_at > CURRENT_TIMESTAMP - INTERVAL '30 minutes' ORDER BY created_at DESC`, [userId, currentHash],
  );
  return rows;
}

async function revoke(userId, publicId, actorId) {
  return transaction(async (client) => {
    const { rows } = await client.query(
      `DELETE FROM "TB_SESSIONS" WHERE user_id = $1 AND public_id = $2 RETURNING token_hash`, [userId, publicId],
    );
    if (!rows[0]) return null;
    await Audit.record('session.revoked', actorId, actorId, {}, client);
    return rows[0];
  }, actorId);
}

async function revokeAll(userId, actorId) {
  await transaction(async (client) => {
    await client.query('UPDATE "TB_USERS" SET auth_version = auth_version + 1 WHERE id = $1', [userId]);
    await Audit.record('auth.logout_all', actorId, actorId, {}, client);
  }, actorId);
}

module.exports = { create, find, touch, remove, consume, list, revoke, revokeAll };
