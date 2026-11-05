const pool = require('../../../config/database');
const transaction = require('../../shared/utils/transaction');
const Audit = require('../audit/audit.model');
const HttpError = require('../../shared/utils/http-error');

async function find(userId) {
  const { rows } = await pool.query('SELECT * FROM "TB_USER_MFA" WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

async function setup(userId, encryptedSecret, sessionHash) {
  const { rowCount } = await pool.query(
    `INSERT INTO "TB_USER_MFA" (user_id, encrypted_secret, pending_session_hash, expires_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '10 minutes')
     ON CONFLICT (user_id) DO UPDATE SET encrypted_secret = EXCLUDED.encrypted_secret,
       pending_session_hash = EXCLUDED.pending_session_hash, expires_at = EXCLUDED.expires_at
     WHERE "TB_USER_MFA".enabled = FALSE`, [userId, encryptedSecret, sessionHash],
  );
  if (!rowCount) throw new HttpError(409, 'MFA sudah aktif');
}

async function enable(user, encryptedSecret, sessionHash, counter, recoveryHashes) {
  return transaction(async (client) => {
    const account = await client.query('SELECT id FROM "TB_USERS" WHERE id = $1 AND auth_version = $2 AND is_active = TRUE FOR UPDATE', [user.id, user.auth_version]);
    if (!account.rows[0]) throw new HttpError(401, 'Kredensial berubah, login ulang');
    const { rowCount } = await client.query(
      `UPDATE "TB_USER_MFA" SET enabled = TRUE, pending_session_hash = NULL,
       expires_at = NULL, last_counter = $4, recovery_hashes = $5
       WHERE user_id = $1 AND encrypted_secret = $2 AND pending_session_hash = $3
       AND enabled = FALSE AND expires_at > CURRENT_TIMESTAMP`,
      [user.id, encryptedSecret, sessionHash, counter, recoveryHashes],
    );
    if (!rowCount) throw new HttpError(409, 'Setup MFA kedaluwarsa atau berubah');
    await client.query('UPDATE "TB_USERS" SET auth_version = auth_version + 1 WHERE id = $1', [user.id]);
    await Audit.record('mfa.enabled', user.public_id, user.public_id, {}, client);
  }, user.public_id);
}

async function consumeCounter(userId, counter) {
  const { rowCount } = await pool.query(
    `UPDATE "TB_USER_MFA" SET last_counter = $2
     WHERE user_id = $1 AND enabled = TRUE AND last_counter < $2`, [userId, counter],
  );
  return rowCount === 1;
}

async function consumeRecovery(userId, hash) {
  const { rowCount } = await pool.query(
    `UPDATE "TB_USER_MFA" SET recovery_hashes = array_remove(recovery_hashes, $2)
     WHERE user_id = $1 AND enabled = TRUE AND $2 = ANY(recovery_hashes)`, [userId, hash],
  );
  return rowCount === 1;
}

async function disable(user) {
  await transaction(async (client) => {
    // User row first: auth_version also protects against concurrent credential changes.
    const account = await client.query('SELECT id FROM "TB_USERS" WHERE id = $1 AND auth_version = $2 FOR UPDATE', [user.id, user.auth_version]);
    if (!account.rows[0]) throw new HttpError(401, 'Kredensial berubah, login ulang');
    await client.query('DELETE FROM "TB_USER_MFA" WHERE user_id = $1', [user.id]);
    await client.query('UPDATE "TB_USERS" SET auth_version = auth_version + 1 WHERE id = $1', [user.id]);
    await Audit.record('mfa.disabled', user.public_id, user.public_id, {}, client);
  }, user.public_id);
}

module.exports = { find, setup, enable, consumeCounter, consumeRecovery, disable };
