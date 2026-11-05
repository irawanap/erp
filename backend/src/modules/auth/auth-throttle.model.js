const pool = require('../../../config/database');

async function increment(keyHash, seconds) {
  const { rows } = await pool.query(
    `INSERT INTO "TB_AUTH_THROTTLES" (key_hash, attempts, expires_at)
     VALUES ($1, 1, CURRENT_TIMESTAMP + $2 * INTERVAL '1 second')
     ON CONFLICT (key_hash) DO UPDATE SET
       attempts = CASE WHEN "TB_AUTH_THROTTLES".expires_at <= CURRENT_TIMESTAMP
                       THEN 1 ELSE "TB_AUTH_THROTTLES".attempts + 1 END,
       expires_at = CASE WHEN "TB_AUTH_THROTTLES".expires_at <= CURRENT_TIMESTAMP
                         THEN EXCLUDED.expires_at ELSE "TB_AUTH_THROTTLES".expires_at END
     RETURNING attempts, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))))::int AS retry_after`,
    [keyHash, seconds],
  );
  return rows[0];
}

module.exports = { increment };
