# HRD Web Based ERP

HRD technical test untuk pengelolaan karyawan, cuti, approval, dan laporan. Frontend tersedia untuk autentikasi/MFA, dashboard sesuai role, pengelolaan akun dan session, departemen, karyawan, user, konfigurasi cuti, pengajuan, approval Supervisor, serta laporan HRD dengan ekspor CSV.

Panduan menjalankan frontend tersedia di [frontend/README.md](frontend/README.md).

## Fitur

- Akun dan role HRD/Admin, Supervisor, serta Employee, dengan session cookie, CSRF, MFA authenticator, dan audit.
- Data karyawan, departemen, atasan, status kerja, pencarian, dan filter.
- Jenis cuti, kalender libur, saldo tahunan, draft, submit, dan pembatalan.
- Approval tim dengan komentar wajib dan pemotongan saldo dalam transaksi.
- Dashboard sesuai hak akses dan laporan penggunaan cuti dengan ekspor CSV.

## Menjalankan backend

Memerlukan Node.js >=22.12.0 dan PostgreSQL. Buat database kosong, lalu:

```sh
cd backend
npm ci
cp .env.example .env
```

Isi konfigurasi database pada `.env`. Buat dua secret berbeda menggunakan `openssl rand -hex 32`, masing-masing untuk `SESSION_SECRET` dan `MFA_ENCRYPTION_KEY`.

```sh
npm run db:setup
npm run db:seed:demo
npm run dev
```

API berjalan di `http://localhost:3000`. Health check: `GET /api/health`.

Seed demo menyediakan lima karyawan dari soal, entitlement awal 12 hari, serta contoh pengajuan. Password acak akun baru disimpan di `backend/.demo-accounts.json`, khusus lokal dan tidak masuk Git. Admin perlu enrollment MFA sebelum mengelola data. Jika tidak memakai demo, buat admin melalui `npm run auth:create-admin`.

## Pengujian

Jalankan dari folder `backend`:

```sh
npm test
RUN_DB_TESTS=1 npm test
```

Tes integrasi membutuhkan PostgreSQL dan izin CREATE SCHEMA. Setiap suite memakai schema sementara yang dibersihkan setelah tes. Verifikasi backend terakhir: 135 tes lulus, termasuk scope role dan approval bersamaan.

## Struktur

```text
backend/
  config/               Konfigurasi database dan autentikasi
  database/migrations/  Perubahan schema
  database/seeds/       Master dan data demonstrasi
  src/modules/          Auth, users, employees, cuti, approval, laporan
  src/shared/           Middleware, validasi, dan utilitas bersama
  tests/                Tes per fitur dan integrasi
  docs/                 Kontrak API, keamanan, dan Postman
```


## Dokumentasi untuk frontend

- [Kontrak API ERP](backend/docs/erp-api.md)
- [OpenAPI JSON](backend/docs/openapi.json)
- [Postman lengkap](backend/docs/postman/HRD_ERP_Complete.postman_collection.json) dan [environment lokal](backend/docs/postman/HRD_ERP_Local.postman_environment.json)
- [Panduan Postman](backend/docs/postman/README.md)
- [Pemetaan requirement technical test](backend/docs/technical-test.md)
- [Arsitektur](backend/docs/architecture.md) dan [keamanan/MFA](backend/docs/security.md)

Kebijakan awal: Senin–Jumat, hari libur aktif dikecualikan, satu approver atasan langsung, saldo tahunan diisi HRD, dan pembatalan hanya Draft/Submitted. Penjelasan batas cakupan dan deployment tersedia dalam dokumentasi backend.

## Pemeriksaan frontend dan browser

Jalankan `cd frontend && npm run check` untuk lint, build, dan unit/component test. Jalankan `npm run test:e2e` dari folder frontend untuk browser test dengan PostgreSQL sementara. Lihat [TESTING.md](TESTING.md) untuk prasyarat, isolasi data, hasil lokal, dan workflow CI.
