require('dotenv').config();
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const direction = process.argv[2];
if (!['up', 'down'].includes(direction)) {
  console.error('Usage: node scripts/migrate.js <up|down>');
  process.exit(1);
}

const databaseUrl = new URL('postgresql://localhost');
databaseUrl.hostname = process.env.DB_HOST || 'localhost';
databaseUrl.port = process.env.DB_PORT || '5432';
databaseUrl.pathname = `/${process.env.DB_NAME || 'hrd_erp'}`;
databaseUrl.username = process.env.DB_USER || 'postgres';
databaseUrl.password = process.env.DB_PASSWORD || '';

const result = spawnSync(process.execPath, [
  path.resolve(__dirname, '../node_modules/node-pg-migrate/bin/node-pg-migrate.js'),
  direction,
  '--migrations-dir', path.resolve(__dirname, '../database/migrations'),
], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: databaseUrl.toString() },
});

if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
