# Backend HRD ERP

## Cakupan technical test

Backend mengikuti **TECHNICAL TEST HRD WEB BASED ERP-1.pdf**: Employee Management, Leave Management, Approval Workflow, serta Dashboard & Reporting (ekspor CSV). Pemetaan requirement dan kebijakan yang disetujui tersedia di [docs/technical-test.md](docs/technical-test.md). Frontend belum dibuat.

Kontrak utama frontend: [docs/erp-api.md](docs/erp-api.md), [OpenAPI](docs/openapi.json), dan `docs/postman/HRD_ERP_Complete.postman_collection.json`.

## Menjalankan

Gunakan Node.js >=22.12.0 sesuai engines pada package.json.

Salin `.env.example` ke `.env`, isi konfigurasi PostgreSQL serta `SESSION_SECRET` dan `MFA_ENCRYPTION_KEY` (masing-masing hasil terpisah dari `openssl rand -hex 32`), lalu buat database sesuai `DB_NAME`.

```sh
npm install
npm run db:setup
# Opsional: data simulasi wajib PDF untuk demonstrasi lokal
npm run db:seed:demo
npm run dev
```

Seed demo menghasilkan lima karyawan, entitlement 12 hari, contoh workflow, serta akun demo dengan password acak di `.demo-accounts.json` (di-ignore Git, jangan dibagikan). Jika tidak menggunakan demo, buat admin melalui `npm run auth:create-admin` hanya jika belum tersedia. Script meminta email dan password dengan input password tersembunyi. Admin lama tetap bisa login. Tidak ada password atau akun admin bawaan.

## Struktur

```text
config/                 Konfigurasi database dan autentikasi
database/migrations/   Migration berurutan lintas modul
scripts/                Operasional database dan admin
src/
  app.js                Setup Express dan middleware global
  routes.js             Pendaftaran route modul
  modules/
    auth/               Login, register, MFA, session, throttle
    users/              Pengelolaan akun
    access/             Daftar role dan izin
    audit/              Pencatatan dan pembacaan audit
  shared/
    middlewares/        Authenticate, authorize, CSRF, security, error handler
    validators/         UUID, email, password, pagination
    utils/              HttpError dan transaction
tests/
  auth/
  users/
  access/
  helpers/
docs/
```

Alur request: routes → middleware → controller → service → model. Modul sederhana seperti access tidak memerlukan service/model jika tidak memiliki proses bisnis atau query. File memakai nama fitur dan fungsi, misalnya `user.controller.js`, agar mudah dikenali di tab editor.

Panduan penambahan fitur, batas tanggung jawab, dan contoh pendaftaran route tersedia di [docs/architecture.md](docs/architecture.md).

## Autentikasi

Autentikasi sekarang memakai **opaque session cookie**, menggantikan Bearer JWT manual dari implementasi awal. Session disimpan di `TB_SESSIONS`, dengan ID acak 256 bit; database hanya menyimpan SHA-256 ID tersebut. Tidak ada access token yang perlu disimpan di localStorage atau variabel Postman.

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/v1/auth/csrf` | Session anonymous dan CSRF token; memakai session yang ada jika masih valid |
| POST | `/api/v1/auth/register` | Registrasi Employee, jika diaktifkan |
| POST | `/api/v1/auth/login` | Login dan rotasi session/CSRF |
| GET | `/api/v1/auth/me` | Akun aktif |
| POST | `/api/v1/auth/logout` | Cabut session server dan hapus cookie |

Urutan klien:

1. GET `/api/v1/auth/csrf`, simpan `data.csrfToken` di memori.
2. POST login/register dengan cookie yang sama, `Content-Type: application/json`, dan `X-CSRF-Token`.
3. Setelah login, gunakan CSRF token baru dari response. Cookie diganti otomatis.
4. Kirim cookie pada request berikutnya. Semua POST/PATCH/DELETE, termasuk logout dan CRUD users, wajib memakai CSRF token.
5. Setelah logout atau session kedaluwarsa, mulai dari langkah pertama.

Browser menggunakan `credentials: 'include'` pada fetch. Origin frontend harus terdaftar tepat di `CORS_ORIGIN`. Cookie SameSite Strict mengharuskan frontend dan API berada pada site yang sama; port berbeda di localhost tetap bisa. Deployment frontend dan API pada domain site berbeda membutuhkan desain cookie/CSRF lain.

Body login:

```json
{ "email": "admin@example.com", "password": "password-admin-anda" }
```

Response login:

```json
{
  "success": true,
  "data": {
    "user": { "id": "11111111-1111-4111-8111-111111111111", "email": "admin@example.com", "role": "HRD/Admin", "is_active": true },
    "csrfToken": "<token-csrf-baru>"
  }
}
```

Response `user` sebenarnya juga menyertakan employee_id dan timestamp, tanpa password/hash. Cookie tidak dikembalikan melalui JSON.

### Register

Registrasi publik **default nonaktif**. Untuk mencobanya, set `ENABLE_PUBLIC_REGISTRATION=true` dan restart server. Untuk ERP internal, pembuatan akun biasanya dilakukan HRD melalui API users.

```json
{ "email": "employee@example.com", "password": "password-panjang-untuk-akun" }
```

Role selalu Employee dan akun aktif. Body tidak boleh memuat role/status/employeeId. Password baru minimal 15 karakter dan maksimal 72 byte UTF-8, bcrypt cost 12. Login tetap menerima password akun lama yang lebih pendek. Tidak ada syarat karakter khusus; passphrase panjang diperbolehkan.

Respons 202 generik untuk email baru maupun duplikat, tanpa otomatis login, untuk mengurangi pengungkapan keberadaan akun. Belum ada verifikasi email atau pemulihan password melalui email. MFA authenticator tersedia; lihat panduan keamanan di bawah. Jangan mengaktifkan registrasi publik jika organisasi memerlukan verifikasi/invitation sebelum akun boleh dipakai. Akun belum dikaitkan ke employee.

### Session dan proteksi

- Cookie HttpOnly, SameSite Strict, tanpa Domain, Path `/`.
- Production (`NODE_ENV=production`): cookie `__Host-hrd_session` dengan Secure; request HTTP ditolak. Development memakai `hrd_session` agar dapat diuji melalui HTTP localhost.
- Session authenticated berakhir setelah 2 jam secara absolut atau 30 menit tidak aktif. Session anonymous berakhir setelah 15 menit.
- Login mengonsumsi session sebelumnya dan membuat session baru. Session lama tidak dapat dipakai kembali. Logout mencabut session pada database.
- Trigger database mencabut semua session user dan menaikkan auth_version bila email/password/role/status berubah. Versi juga dicek saat membaca session agar session dari login bersamaan tidak lolos setelah perubahan kredensial.
- CSRF token terikat ke session dengan HMAC-SHA256 dan diperiksa dengan perbandingan constant-time.
- Origin allowlist dan Fetch Metadata menolak request cross-site. SameSite melengkapi pemeriksaan CSRF.
- Akun tidak aktif, tidak ditemukan, dan password salah menghasilkan pesan login yang sama. Email tidak ditemukan tetap menjalankan bcrypt compare.
- Mutasi users memerlukan autentikasi yang masih berusia maksimal 5 menit. Gunakan endpoint reauthenticate jika melewati batas tersebut.
- Helmet, no-store pada response API, JSON maksimal 16 KB, serta redaksi cookie/CSRF/Authorization pada log HTTP.

`SESSION_SECRET` harus acak dan minimal 32 byte. `JWT_SECRET` lama hanya diterima sebagai fallback di development jika SESSION_SECRET tidak ada, tetapi Bearer JWT lama tidak diterima sebagai autentikasi. Ganti secret dengan terencana: token CSRF lama akan tidak valid, walaupun cookie session masih ada.

### Pembatasan request

| Lingkup | Batas | Penyimpanan |
| --- | --- | --- |
| API per IP | 300 / 5 menit | Memori tiap proses |
| Ambil CSRF per IP | 60 / 5 menit | PostgreSQL |
| Login per IP | 30 / 15 menit | PostgreSQL |
| Login per email | 10 / 15 menit | PostgreSQL |
| Register per IP | 5 / jam | PostgreSQL |

Semua percobaan login termasuk yang sukses dihitung. Batas menggunakan fixed window sejak request pertama. Key email/IP di database di-HMAC; alamat IPv6 dikelompokkan per /56 untuk batas IP. Respons 429 memiliki Retry-After. Jika penyimpanan throttle gagal, login ditolak dengan error internal, bukan melewati pemeriksaan. Request tidak ditunda dengan sleep yang menghabiskan worker.

Jalankan `npm run auth:cleanup` secara berkala, misalnya setiap jam lewat scheduler deployment, untuk membersihkan session dan throttle kedaluwarsa. Session habis tetap ditolak walaupun cleanup belum berjalan.

Di production, gunakan HTTPS dan reverse proxy yang dikelola sendiri. Isi `TRUST_PROXY` hanya dengan alamat/CIDR proxy tersebut, misalnya `127.0.0.1/32` untuk proxy lokal. Proxy wajib mengatur ulang forwarded headers. Biarkan kosong jika aplikasi menerima koneksi langsung. Isi `CORS_ORIGIN` dengan origin HTTPS frontend; beberapa origin dipisahkan koma. Jangan memakai konfigurasi trust proxy terbuka.

## Users

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| POST | `/api/v1/users` | Membuat akun |
| GET | `/api/v1/users` | Daftar, pencarian email, pagination |
| GET | `/api/v1/users/:id` | Detail |
| PATCH | `/api/v1/users/:id` | Update field yang dikirim |
| DELETE | `/api/v1/users/:id` | Nonaktifkan (`is_active = false`) |

Semua endpoint users memerlukan session akun aktif HRD/Admin. POST menerima email/password/role (default Employee). PATCH menerima email/password/role/isActive; body kosong dan field lain ditolak. Role: Employee, Supervisor, HRD/Admin. DELETE dapat diulang; tidak menghapus baris. PATCH `{"isActive":true}` mengaktifkan kembali.

Query GET daftar: page (default 1, maksimal 1000000), limit (default 10, maksimal 100), search (sebagian email, maksimal 255 karakter), role, isActive (true/false). Urutan ID terbaru. Response akun memakai snake_case dengan ID UUID v4 string. BIGINT tetap digunakan hanya untuk relasi internal.

Response detail: `{"success":true,"data":{...}}`. Daftar menyertakan pagination: page, limit, total, totalPages.
Error: `{"success":false,"message":"..."}`; validasi menambahkan errors berisi field/message. Status 400 JSON rusak/HTTPS, 401 autentikasi, 403 izin/CSRF/origin, 404 data hilang, 409 duplikat users, 413 payload besar, 415 tipe konten, 422 validasi, 429 throttle, 500 internal, 503 secret belum dikonfigurasi.

## Database dan pengujian

Nama tabel uppercase memerlukan tanda kutip ganda di PostgreSQL. `employee_id` nullable/unique memiliki foreign key ke TB_EMPLOYEES. Pengaitan dilakukan melalui PATCH /users/:id/employee; response menggunakan UUID. Status employee diperiksa saat login/session; nonaktif mencabut session. Migration auth tidak menghapus data user. Rollback migration dapat menghapus session/throttle terkait.

```sh
npm test
RUN_DB_TESTS=1 npm test
```

Tes normal memakai database mock. Tes PostgreSQL opsional membuat schema sementara dan menjalankan seluruh migration di sana, lalu menghapus schema tersebut. User dan throttle aplikasi lokal tidak disentuh. Role database untuk tes memerlukan izin CREATE SCHEMA.

## Postman

Import ulang [collection dan environment](docs/postman/README.md). Isi kredensial admin, lalu jalankan CSRF → Login → Me → Users → Logout. Cookie dan token CSRF dikelola otomatis, tanpa menyalin adminToken.

## Acuan

Implementasi mengikuti prinsip pada [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), dan [Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). Keamanan production juga bergantung pada HTTPS, konfigurasi proxy, pengelolaan secret, monitoring, dan kebijakan akses organisasi; implementasi ini belum merupakan audit keamanan independen.

## Penguatan auth, role, dan users

Panduan lengkap ada di [docs/security.md](docs/security.md), termasuk setup MFA, izin per aksi, audit, batas operasional, dan perbedaan ID internal/publik.

- Semua ID akun pada response dan URL users sekarang **UUID v4**. Endpoint dengan ID angka lama menghasilkan 422. Data lama mendapat UUID melalui migration.
- Izin role dipusatkan di `src/modules/access/roles.js` dan diperiksa per route. Role tidak dikenal ditolak. Endpoint `GET /api/v1/roles` menampilkan daftar role dan izin untuk admin.
- Admin tidak boleh mengganti role atau menonaktifkan akun sendiri. Admin aktif terakhir dilindungi juga oleh trigger database. Mutasi users memakai transaction dan memeriksa ulang versi/role actor setelah mengambil lock.
- MFA authenticator tersedia melalui `/auth/mfa/setup`, `/auth/mfa/confirm`, dan `/auth/mfa/disable`. Admin wajib login dengan MFA untuk mengakses users/roles/audit di production; MFA admin juga default aktif di lokal; hanya development dapat menonaktifkannya dengan `REQUIRE_ADMIN_MFA=false`.
- Session dibatasi maksimal 5 per akun. `GET /auth/sessions`, `DELETE /auth/sessions/:id`, dan `POST /auth/logout-all` memberikan kontrol session milik sendiri.
- `POST /auth/reauthenticate` merotasi session/CSRF setelah verifikasi password dan MFA bila aktif. `POST /auth/change-password` memerlukan password lama dan MFA, lalu mencabut seluruh session.
- Audit disimpan di `TB_AUDIT_LOGS`; `GET /api/v1/audit-logs` hanya untuk admin dengan autentikasi baru. Nilai password, hash, email, OTP, recovery code, dan secret tidak dimasukkan ke details audit.

`/auth/...` pada daftar di atas memakai prefix `/api/v1`. Reimport collection Postman setelah pembaruan ini. Folder aksi keamanan opsional harus dijalankan satu per satu, bukan sebagai satu alur Runner.

## Departments

API departments tersedia untuk daftar, detail, tambah, dan ubah. Semua role dapat membaca; admin dengan CSRF dan autentikasi baru dapat mengubah. Gunakan `npm run db:setup` untuk migration serta seed awal. Kontrak frontend dan contoh request tersedia di [docs/departments-api.md](docs/departments-api.md). Collection Postman khusus departments juga tersedia pada folder docs/postman.

## Modul ERP

Modul tambahan berada di `src/modules/employees`, `leave-types`, `leave-balances`, `holidays`, `leave-requests`, `approvals`, `dashboard`, dan `reports`. Setiap modul menyimpan route/controller/service/model/validation sesuai kebutuhan. Query bersama untuk scope, pagination, dan transaksi HR/cuti ada di shared/utils/business.js.

Saldo demo 12 merupakan entitlement simulasi, bukan kebijakan perusahaan. Hari kerja Senin–Jumat (WORK_WEEKDAYS), approval satu atasan langsung, saldo diisi per tahun tanpa reset otomatis, dan cancel hanya Draft/Submitted. Pengajuan lintas tahun dipecah. Submitted belum mereservasi saldo; approval memeriksa ulang secara atomik.

Request edit/submit/approve memvalidasi hari kerja, saldo, dan bentrok Approved. Seluruh mutasi HR/cuti dikoordinasikan dengan lock transaksi sederhana untuk menjaga konsistensi pada technical test. Ini menyederhanakan concurrency tetapi membatasi throughput tulis; evaluasi granular locking sebelum skala besar. Tidak ada pemanggilan layanan eksternal di dalam transaksi tersebut.
