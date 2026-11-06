# Pengujian ERP

Gunakan Node.js 22.13+ pada seri 22 atau Node 24+, dependency backend/frontend yang sudah dipasang, PostgreSQL, serta Chrome/Chromium untuk browser test. Jalankan `nvm use` dari root. Lockfile disertakan agar instalasi konsisten.

## Unit dan komponen frontend

```sh
cd frontend
npm ci --include=optional
npm run check
```

`check` menjalankan ESLint, build TypeScript/Vite, typecheck kode tes, dan Vitest. `npm run test:watch` tersedia saat mengembangkan fitur. Tes mencakup normalisasi dan batas validasi, perubahan field karyawan, hak aksi pada tabel user, state form, redirect saat API tidak tersedia, pengiriman CSRF dan rotasi CSRF setelah reauthentication. Mutation jaringan yang gagal tidak diulang otomatis.

## Unit dan integrasi backend

```sh
cd backend
npm ci
npm test
RUN_DB_TESTS=1 npm test
```

Tanpa RUN_DB_TESTS, suite PostgreSQL dilewati. Set DB_HOST, DB_PORT, DB_NAME, DB_USER, dan DB_PASSWORD melalui environment atau backend/.env untuk integrasi. Gunakan database khusus pengujian. User database harus memiliki izin CREATE SCHEMA; setiap suite memakai schema acak dan membersihkannya setelah tes. Tes tidak menjalankan reset database aplikasi.

## End-to-end browser

```sh
cd frontend
npm run test:e2e
```

Browser test memakai koneksi database yang sama seperti konfigurasi backend, membuat schema sementara, menerapkan migration dan seed demo dalam schema tersebut. Backend dan Vite dijalankan di port localhost acak; tidak perlu menghentikan server development. Kredensial dan secret test dihasilkan acak, hanya berada dalam proses pengujian, serta tidak dicetak. Browser memakai profil sementara yang dihapus setelah selesai.

Script mendeteksi Google Chrome di macOS serta Chrome/Chromium di Linux. Jika executable berada di lokasi lain, atur CHROME_PATH:

```sh
CHROME_PATH=/path/to/chrome npm run test:e2e
```

Skenario meliputi login/logout, pemulihan session, MFA/recovery code, cakupan Employee, administrasi Users, relasi karyawan, master data cuti, saldo, draft/submit/cancel, approval/reject Supervisor, pemotongan saldo, laporan dan unduhan CSV, serta navigasi mobile. Pengujian menggunakan API dan database nyata; input dialog konfirmasi browser diterima otomatis oleh driver. Logger HTTP dibisukan agar kredensial tidak tercetak.

Sebagian skenario menunggu pergantian kode authenticator agar tidak memakai OTP yang sama dua kali. Waktu tes dapat bervariasi. Tes dijalankan berurutan karena satu alur memakai hasil langkah sebelumnya.

Hasil sukses tersimpan di `frontend/test-results/e2e/summary.json`, dengan screenshot login, dashboard, dan akun. Tidak ada screenshot secret MFA atau recovery code. Folder hasil di-ignore Git. Saat gagal, script mengembalikan exit code nonzero dan mencetak tahap/error serta status API terakhir. Bersihkan schema test yang tertinggal secara manual jika proses dihentikan paksa sebelum cleanup.

## CI

`.github/workflows/checks.yml` menjalankan check frontend, seluruh suite backend, dan browser test pada push/pull request dengan PostgreSQL sementara. Workflow ini disiapkan lokal; hasil GitHub Actions baru tersedia setelah perubahan di-push.

## Hasil verifikasi

Hasil lokal terakhir sebelum penyerahan: 45 unit/component test frontend, 135 tes backend termasuk PostgreSQL, dan 29 pemeriksaan E2E lulus. Ini memeriksa alur technical test, bukan pengujian beban atau penetration test.

## Error ERR_REQUIRE_ESM pada Vitest

Jika worker gagal memuat @exodus/bytes dari html-encoding-sniffer, cek `node -v`. Node 22.9 belum memenuhi requirement jsdom. Jalankan `nvm install 22` dan `nvm use 22` pada terminal yang menjalankan tes, lalu ulangi `npm test`. Script pretest menolak versi yang tidak didukung dengan pesan langsung. Tidak perlu mengubah kode node_modules atau menghapus lockfile.
