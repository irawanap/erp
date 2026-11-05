# Postman: Auth dan Users

API sekarang memakai **session cookie + CSRF**, bukan `adminToken` atau Bearer JWT. Import ulang collection dan environment agar konfigurasi lama terganti.

## Persiapan backend

1. Isi `.env`: `SESSION_SECRET` dan `MFA_ENCRYPTION_KEY` dengan dua hasil terpisah dari `openssl rand -hex 32`.
2. Jalankan dari folder `backend`:

   ```sh
   npm run db:migrate
   npm run auth:create-admin
   npm run dev
   ```

   Buat admin hanya jika belum ada. Script meminta email dan password (minimal 15 karakter); password tidak ditampilkan di terminal. Akun admin yang sebelumnya sudah dibuat tetap bisa login menggunakan password lamanya.

## Import dan environment

Import kedua file JSON pada folder ini, lalu pilih **HRD ERP - Local**.

| Variabel | Nilai |
| --- | --- |
| `baseUrl` | `http://localhost:3000` tanpa slash terakhir |
| `loginEmail` | Email admin yang sudah dibuat |
| `loginPassword` | Password admin |
| `userPassword` | Password akun contoh, minimal 15 karakter, maksimal 72 byte UTF-8 |
| `updatedPassword` | Password baru dengan batas yang sama |
| `csrfToken` | Otomatis diisi dari CSRF dan Login |
| `userId` | Otomatis diisi setelah Buat user |
| `userEmail` | Otomatis dibuat unik sebelum Buat user |
| `missingUserId` | ID yang tidak ada, untuk tes 404 |

Isi password hanya di environment lokal. Biarkan cookie jar Postman aktif; jangan menyalin cookie session ke variabel atau Authorization.

## Urutan tes

1. **Health → Health check**: status 200.
2. **Auth → 01 Ambil CSRF**: status 200; Postman menyimpan cookie anonymous dan variabel `csrfToken`.
3. **Auth → 02 Login**: status 200; server mengganti cookie dan token CSRF, keduanya tersimpan otomatis.
4. **Auth → 03 Akun aktif**: status 200, menampilkan admin.
5. Jika admin baru belum memakai MFA, ikuti bagian **UUID, MFA, dan aksi keamanan** untuk Setup/Konfirmasi MFA, lalu login ulang dengan faktor MFA. Akses users sebelum enrollment akan menghasilkan 403.
6. **Users**: jalankan sesuai nomor, dari Buat user sampai Aktifkan kembali.
7. **Skenario error**: menguji 401 tanpa cookie, 422 validasi, 404, 409 email duplikat, serta 403 CSRF salah.
8. **Logout → Logout**: status 200. Request Akun aktif berikutnya harus menghasilkan 401.

Collection Runner dapat menjalankan urutan utama dengan satu iterasi. Folder Registrasi opsional dilewati secara default. Request users mengubah database; setiap Buat user menambah satu akun contoh. DELETE hanya menonaktifkan akun tersebut.

Header untuk mutation (POST/PATCH/DELETE) sudah disediakan:

```text
Content-Type: application/json
X-CSRF-Token: {{csrfToken}}
```

Jangan mengisi Bearer token. Setelah logout/session kedaluwarsa, ulangi Ambil CSRF lalu Login. Jika autentikasi admin sudah lebih dari 5 menit, jalankan Autentikasi ulang atau login kembali sebelum mengubah users.

## Register

Registrasi publik default nonaktif untuk aplikasi HRD. Untuk mencoba:

1. Isi `ENABLE_PUBLIC_REGISTRATION=true` di `.env`, lalu restart backend.
2. Isi environment `registerEmail`, `registerPassword`, dan `runRegistration=true`.
3. Jalankan Ambil CSRF, lalu **Registrasi opsional → Register Employee**.
4. Status **202** berlaku untuk email baru maupun email yang sudah terdaftar. Register tidak otomatis login.
5. Ubah `loginEmail`/`loginPassword` ke kredensial Employee, lalu jalankan Login dan Akun aktif. Akses Users akan menghasilkan **403** karena bukan admin.
6. Kembalikan `runRegistration=false` serta kredensial admin sebelum menjalankan collection utama.

Body register hanya menerima email dan password. Mengirim role/isActive ditolak dengan 422. Untuk ERP internal, nonaktifkan kembali registrasi setelah pengujian jika pembuatan akun seharusnya dilakukan HRD.

## Endpoint dan error

| Method | Endpoint | Sukses |
| --- | --- | --- |
| GET | `/api/health` | 200 |
| GET | `/api/v1/auth/csrf` | 200 |
| POST | `/api/v1/auth/register` | 202 |
| POST | `/api/v1/auth/login` | 200 |
| GET | `/api/v1/auth/me` | 200 |
| POST | `/api/v1/auth/logout` | 200 |
| POST | `/api/v1/users` | 201 |
| GET | `/api/v1/users` | 200 |
| GET | `/api/v1/users/:id` | 200 |
| PATCH | `/api/v1/users/:id` | 200 |
| DELETE | `/api/v1/users/:id` | 200 |

Query daftar users: `page` (default 1, maksimal 1000000), `limit` (default 10, maksimal 100), `search` (sebagian email), `role`, dan `isActive` (`true`/`false`). Filter role/status awalnya tidak dicentang di tab Params.
POST users menerima email, password, dan role opsional. PATCH menerima email/password/role/isActive, minimal satu field. Response akun memakai snake_case dan ID berupa string; password/hash tidak dikembalikan.

| Status | Arti |
| --- | --- |
| 400 | JSON rusak atau HTTP digunakan di production |
| 401 | Kredensial salah, session habis/dicabut, atau perlu login ulang |
| 403 | CSRF/origin salah, role tidak berhak, atau registrasi dinonaktifkan |
| 404 | Data/route tidak ditemukan |
| 409 | Email duplikat pada CRUD users |
| 413 | JSON melebihi 16 KB |
| 415 | Mutation tanpa Content-Type application/json |
| 422 | Validasi gagal |
| 429 | Batas request tercapai; lihat header Retry-After |
| 500 | Error internal |
| 503 | Secret session belum dikonfigurasi dengan benar |

Untuk tes throttle, kirim login salah berulang: batas 10 percobaan per email dan 30 per IP dalam 15 menit. Semua percobaan, termasuk yang berhasil, dihitung. Tunggu sesuai Retry-After sebelum melanjutkan; restart server tidak menghapus throttle database.

Contoh response tersimpan adalah ilustrasi. Tes post-response memeriksa status dan ketiadaan password; pengisian cookie dilakukan Postman secara otomatis.

## UUID, MFA, dan aksi keamanan

Import ulang kedua file JSON. Semua request users memakai UUID publik pada `userId`; ID angka lama ditolak. Buat user akan menyimpan UUID secara otomatis. Jangan mengisi userId dengan ID internal database.

Bila akun sudah memakai MFA, isi `loginOtp` dengan enam digit authenticator sebelum Login. Biarkan `loginRecoveryCode` kosong. Untuk recovery, kosongkan loginOtp dan isi satu loginRecoveryCode. Field faktor yang kosong otomatis dihapus dari body. OTP/recovery code hanya sekali pakai; gunakan kode baru untuk request autentikasi berikutnya.

Folder **Roles dan audit** menampilkan izin serta audit untuk admin. Folder **Keamanan opsional** dilewati oleh Runner secara default menggunakan [skipRequest](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-execution). Untuk memakainya, set `runSecurityActions=true` dan kirim request satu per satu; jangan menjalankan folder ini sekaligus.

- **Autentikasi ulang** memakai loginPassword dan faktor MFA bila aktif. Cookie/CSRF baru otomatis disimpan.
- **Setup MFA** memakai password sekarang. Impor secret/URI response ke authenticator secara lokal, lalu isi loginOtp dan jalankan **Konfirmasi MFA** dalam 10 menit dengan session yang sama.
- **Konfirmasi MFA** menampilkan delapan recovery codes sekali saja dan mengakhiri semua session. Simpan kode secara offline. Ambil CSRF lalu login ulang menggunakan OTP periode berikutnya atau recovery code.
- **Ubah password sendiri** memakai loginPassword sebagai password lama dan newLoginPassword sebagai password baru. Faktor MFA wajib bila aktif. Setelah berhasil, perbarui loginPassword, ambil CSRF, dan login kembali.
- **Session aktif** menampilkan session sendiri dan menyimpan UUID session lain ke sessionId jika ada. **Cabut session tertentu** memerlukan sessionId milik sendiri serta autentikasi baru.
- **Logout semua session** mengakhiri seluruh session akun, termasuk session saat ini.
- **Nonaktifkan MFA** memerlukan password dan faktor MFA; ditolak untuk admin ketika MFA diwajibkan. Keberhasilan mencabut seluruh session.

Production selalu mewajibkan MFA untuk akses users/roles/audit oleh admin. Kebijakan MFA admin juga default aktif di lokal; `REQUIRE_ADMIN_MFA=false` hanya boleh dipakai sebagai opt-out development. Panduan lengkap: [security.md](../security.md).

## Departments

Import ulang environment agar variabel departmentId/departmentCode/missingDepartmentId tersedia. Gunakan folder Departments pada collection utama, atau import HRD_ERP_Departments.postman_collection.json untuk mencoba Auth dan Departments saja. Jalankan CSRF dan login admin (dengan MFA jika aktif), lalu buat → daftar → detail → ubah. UUID departemen tersimpan otomatis. Contoh 409/422/404 disediakan. Tidak ada request DELETE. Kontrak frontend: [departments-api.md](../departments-api.md).

## Technical test lengkap sesuai PDF

Import `HRD_ERP_Complete.postman_collection.json` dan environment terbaru. Collection ini mencakup employees, jenis cuti, kalender, saldo, request, approval, dashboard dan laporan CSV. Jalankan manual per role; jangan menjalankan seluruh folder sekaligus.

1. Jalankan backend setup/demo sesuai [technical-test.md](../technical-test.md). Kredensial awal ada di file lokal backend/.demo-accounts.json; jangan dimasukkan ke collection yang dibagikan.
2. Isi loginEmail/loginPassword untuk akun yang akan diuji. Admin harus setup MFA sesuai kebijakan. Login selalu diawali CSRF dan menyimpan token baru.
3. Untuk HRD: ambil referensi employees/departments/leave-types, kelola master dan saldo, lihat dashboard/laporan. employeeNik default EMP001 dipakai untuk memilih UUID pada daftar; ID disimpan ke employeeId.
4. Untuk Employee Andi: login ulang, ambil ANNUAL leaveTypeId, isi leaveStartDate/leaveEndDate dalam tahun saldo, lalu buat draft dan submit. leaveRequestId tersimpan otomatis. Jangan kirim Cancel bila akan menguji Approve.
5. Untuk Supervisor Budi: login ulang (CSRF baru), buka pending, lalu jalankan salah satu Approve atau Reject. Comment wajib. Dewi memproses Citra, bukan tim Budi.
6. Untuk HRD: login ulang, cek used_days dan laporan. Report start/end wajib; filter departmentId opsional bisa ditambah melalui Params.

Semua mutation ERP pada collection opsional dan dilewati kecuali runErpWrites=true. Kirim satu per satu setelah mengecek role/ID. Nonaktif karyawan dan link akun dapat mencabut session. Demo menggunakan tahun saat seed dijalankan; sesuaikan periodYear dan tanggal request/report. Approve/reject dan mutasi HRD memerlukan autentikasi berusia maksimal lima menit.

Kontrak lengkap: [erp-api.md](../erp-api.md). OpenAPI JSON dapat diimpor ke Postman sebagai alternatif; collection manual menyediakan alur cookie/CSRF yang lebih siap dicoba.
