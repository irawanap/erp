require('dotenv').config();
const pool = require('../config/database');

async function cleanup() {
  await pool.query(`DELETE FROM "TB_SESSIONS"
    WHERE expires_at <= CURRENT_TIMESTAMP OR last_seen_at <= CURRENT_TIMESTAMP - INTERVAL '30 minutes'`);
  await pool.query('DELETE FROM "TB_AUTH_THROTTLES" WHERE expires_at <= CURRENT_TIMESTAMP');
  await pool.query('DELETE FROM "TB_USER_MFA" WHERE enabled = FALSE AND expires_at <= CURRENT_TIMESTAMP');
}

cleanup().catch(() => {
  console.error('Auth cleanup gagal');
  process.exitCode = 1;
}).finally(() => pool.end());
