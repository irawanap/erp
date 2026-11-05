require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const pool = require('../config/database');
const transaction = require('../src/shared/utils/transaction');
const seed = require('../database/seeds/demo.seed');
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed demo hanya untuk development/test');
  const year = Number(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric'
  }).format(new Date()));
  const file = path.resolve(__dirname, '../.demo-accounts.json');
  // Refuse to overwrite an unreadable credential file before changing the database.
  const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  const credentials = await transaction(db => seed(db, year));
  fs.writeFileSync(file, JSON.stringify([...old, ...credentials], null, 2) + '\n', {
    mode: 0o600
  });
  fs.chmodSync(file, 0o600);
  console.log(`Demo siap: 5 karyawan dan saldo simulasi ${year}. Kredensial baru tersimpan di backend/.demo-accounts.json (jangan dibagikan).`);
}
main().catch(error => {
  console.error('Seed demo gagal:', error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
