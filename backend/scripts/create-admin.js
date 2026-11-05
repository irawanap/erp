require('dotenv').config();
const { createInterface } = require('node:readline/promises');
const { Writable } = require('node:stream');
const users = require('../src/modules/users/user.service');
const pool = require('../config/database');

async function main() {
  if (!process.stdin.isTTY) throw new Error('Jalankan melalui terminal interaktif');
  let hidden = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!hidden) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const prompt = createInterface({ input: process.stdin, output, terminal: true });
  try {
    const email = await prompt.question('Email admin: ');
    process.stdout.write('Password admin (minimal 15 karakter; input disembunyikan): ');
    hidden = true;
    const password = await prompt.question('');
    hidden = false;
    process.stdout.write('\n');
    const admin = await users.create({ email, password, role: 'HRD/Admin' });
    console.log(`Admin berhasil dibuat dengan ID ${admin.id}`);
  } finally {
    hidden = false;
    prompt.close();
  }
}

main().catch((error) => {
  if (error.code === '23505') console.error('Email sudah digunakan');
  else if (error.issues) console.error(error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
  else console.error('Admin gagal dibuat. Periksa koneksi database dan konfigurasi.');
  process.exitCode = 1;
}).finally(() => pool.end());
