const pool = require('../../../config/database');
const transaction = require('../../shared/utils/transaction');
const HttpError = require('../../shared/utils/http-error');

async function findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT u.id,u.public_id,u.email,u.password_hash,u.is_active,u.auth_version,e.employment_status AS employee_status
     FROM "TB_USERS" u LEFT JOIN "TB_EMPLOYEES" e ON e.id=u.employee_id WHERE u.email=$1`, [email],
  );
  return rows[0] || null;
}

async function markLogin(id, version) {
  const { rows } = await pool.query(
    `UPDATE "TB_USERS" SET last_login_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND auth_version = $2 AND is_active = TRUE
     AND (employee_id IS NULL OR EXISTS(SELECT 1 FROM "TB_EMPLOYEES" e WHERE e.id=employee_id AND e.employment_status='Active'))
     RETURNING id, public_id, employee_id, (SELECT public_id FROM "TB_EMPLOYEES" e WHERE e.id=employee_id) AS employee_public_id, email, role, is_active, last_login_at, created_at, updated_at, auth_version`,
    [id, version],
  );
  return rows[0] || null;
}

async function register({ email, passwordHash }) {
  await pool.query(
    `INSERT INTO "TB_USERS" (email, password_hash, role)
     VALUES ($1, $2, 'Employee') ON CONFLICT (email) DO NOTHING`,
    [email, passwordHash],
  );
}

async function changePassword(user, passwordHash) {
  return transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE "TB_USERS" SET password_hash = $1 WHERE id = $2 AND auth_version = $3 AND is_active = TRUE
       RETURNING public_id`, [passwordHash, user.id, user.auth_version],
    );
    if (!rows[0]) throw new HttpError(401, 'Kredensial berubah, login ulang');
    return rows[0];
  }, user.public_id);
}

module.exports = { findByEmail, markLogin, register, changePassword };
