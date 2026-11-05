const pool = require('../../../config/database');

async function transaction(work, actorId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (actorId) await client.query("SELECT set_config('app.actor_public_id', $1, TRUE)", [actorId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = transaction;
