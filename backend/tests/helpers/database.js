const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

async function createDatabase() {
  const pool = require('../../config/database');
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  pool.options.options = `-c search_path=${schema},public`;
  await pool.query(`CREATE SCHEMA "${schema}"`);
  const migrations = path.resolve(__dirname, '../../database/migrations');
  for (const file of fs.readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(migrations, file), 'utf8').split('-- Down Migration')[0];
    await pool.query(sql);
  }
  return {
    pool,
    async cleanup() {
      await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
      await pool.end();
    },
  };
}

module.exports = { createDatabase };
