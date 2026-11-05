# Auth, role, dan users

## Konfigurasi awal

Gunakan Node.js >=22.12.0. Isi `.env` dengan dua nilai acak yang berbeda:

```sh
openssl rand -hex 32
openssl rand -hex 32
```

Hasil pertama untuk `SESSION_SECRET`, kedua untuk `MFA_ENCRYPTION_KEY`. Jangan menyamakan keduanya atau menyimpan secret di repository. Encryption key harus tepat 64 karakter hex. Simpan backup encryption key secara aman; kehilangan atau mengganti key tanpa re-enkripsi membuat secret MFA lama tidak dapat dibaca.

```sh
npm run db:migrate
npm run auth:create-admin
npm run dev
```

Migration mempertahankan ID internal dan data user, menambahkan UUID unik untuk user/session, MFA, audit, serta proteksi admin terakhir. Buat admin hanya jika belum ada. Script admin sekarang menampilkan UUID publik.

Production memerlukan HTTPS, origin frontend HTTPS yang tepat, SESSION_SECRET, dan MFA_ENCRYPTION_KEY. Server memeriksa konfigurasi tersebut sebelum menerima koneksi. TRUST_PROXY hanya berisi alamat proxy yang dikelola sendiri. JWT_SECRET lama tidak diterima sebagai fallback di production.

## ID dan izin

Kolom internal `TB_USERS.id` tetap BIGINT, dipakai oleh foreign key. Kolom `public_id` UUID v4 ditampilkan sebagai `id` pada JSON dan dipakai pada URL. API tidak menerima ID angka untuk users/session. UUID menyulitkan penebakan; pemeriksaan izin tetap wajib.

| Role | Profil/session sendiri | Users | Role metadata | Audit |
| --- | --- | --- | --- | --- |
| Employee | Ya | Tidak | Tidak | Tidak |
| Supervisor | Ya | Tidak | Tidak | Tidak |
| HRD/Admin | Ya | Read/write | Read | Read |

Izin dipusatkan di `src/modules/access/roles.js`. Tidak ada endpoint untuk membuat role atau mengubah daftar izin. Supervisor dapat membaca profil/saldo/histori tim langsung dan memproses approval yang ditugaskan; akses users/audit tetap khusus HRD/Admin. Register selalu Employee; field role dari register ditolak.

Semua mutasi users memerlukan session admin, CSRF, dan autentikasi berusia paling lama 5 menit. Transaksi memeriksa kembali role, status, serta auth_version actor dari database setelah mengambil lock. Ini menolak operasi dari session yang hak aksesnya sudah dicabut ketika request lain sedang berlangsung.

Mengganti role atau menonaktifkan akun sendiri ditolak, termasuk UUID yang ditulis uppercase. Admin aktif terakhir tidak dapat dinonaktifkan, diturunkan role-nya, atau dihapus; terdapat pemeriksaan transaksi dan trigger database. Akun admin boleh membuat admin lain, sesuai izin pengelolaan aksesnya.

## MFA authenticator

MFA berlaku untuk semua role jika diaktifkan oleh pemilik akun. Pada production, admin yang belum login menggunakan MFA hanya dapat mengakses fungsi akun sendiri untuk melakukan enrollment; users/roles/audit ditolak. Kebijakan ini selalu aktif di production. Kebijakan juga default aktif di lokal. Hanya development dapat menonaktifkannya dengan `REQUIRE_ADMIN_MFA=false`.

1. Ambil CSRF, lalu login memakai email/password. Login tanpa MFA tetap memungkinkan enrollment admin pertama.
2. POST `/api/v1/auth/mfa/setup`:

   ```json
   { "currentPassword": "password-anda" }
   ```

3. Response berisi `secret` dan URI `otpauth://...`. Impor secret/URI ke aplikasi authenticator. Jangan kirim ke pembuat QR online. Setup hanya berlaku 10 menit dan terikat pada session saat ini.
4. POST `/api/v1/auth/mfa/confirm` dengan `{"otp":"123456"}` dari authenticator.
5. Simpan delapan `recoveryCodes` dari response secara offline; kode hanya ditampilkan saat konfirmasi. Konfirmasi mencabut semua session.
6. Ambil CSRF dan login ulang dengan email/password serta `otp`. Gunakan OTP periode berikutnya karena kode konfirmasi sudah dikonsumsi. Sebagai alternatif darurat, kirim satu `recoveryCode`.

```json
{
  "email": "admin@example.com",
  "password": "password-anda",
  "otp": "123456"
}
```

OTP dan recoveryCode tidak boleh dikirim bersamaan. TOTP enam digit berlaku per 30 detik, menerima toleransi satu periode di kedua arah; sinkronkan jam server. Counter yang telah dipakai tidak diterima lagi, termasuk request bersamaan. Recovery code acak 128 bit hanya bisa dipakai sekali; database menyimpan hash SHA-256, bukan kode asli.

Secret TOTP dienkripsi AES-256-GCM menggunakan key terpisah dan diikat ke ID internal akun melalui authenticated additional data. Data terenkripsi yang dipindahkan ke akun lain tidak dapat didekripsi. Implementasi OTP memakai library OTPAuth.

POST `/api/v1/auth/mfa/disable` memerlukan currentPassword dan OTP/recoveryCode. Ini mencabut seluruh session. Admin tidak dapat menonaktifkan MFA ketika kebijakan MFA admin aktif. Penggantian authenticator/admin yang kehilangan seluruh faktor membutuhkan prosedur pemulihan operasional terkontrol; tidak ada endpoint bypass admin/MFA.

## Autentikasi ulang dan password sendiri

POST `/api/v1/auth/reauthenticate`:

```json
{ "currentPassword": "password-anda", "otp": "123456" }
```

Hilangkan otp jika MFA belum aktif, atau ganti dengan recoveryCode. Response berisi csrfToken baru dan mengganti cookie session. Ini memberi jendela autentikasi baru selama 5 menit untuk mutasi users, pencabutan session tertentu/semua session, dan pembacaan audit. Faktor yang dipakai tidak dapat dipakai ulang pada aksi berikutnya.

POST `/api/v1/auth/change-password`:

```json
{
  "currentPassword": "password-lama-anda",
  "newPassword": "password-baru-yang-panjang",
  "otp": "123456"
}
```

Password baru harus berbeda, minimal 15 karakter dan maksimal 72 byte UTF-8. Semua session dicabut, cookie dihapus, dan pengguna harus login kembali. Perubahan password/email/role/status oleh admin juga mencabut session target melalui trigger database.

## Session

Session cookie HttpOnly, SameSite Strict, Path `/`, tanpa Domain. Production memakai prefix __Host- serta Secure. Browser harus berada pada site yang sama dengan API. Session authenticated: 2 jam absolut, idle 30 menit. Session anonymous: 15 menit. Login/reauthenticate mengganti session ID dan CSRF.

- GET `/api/v1/auth/sessions`: maksimal lima session aktif akun sendiri; UUID session, waktu, dan is_current, tanpa token/hash session.
- DELETE `/api/v1/auth/sessions/:id`: cabut session milik sendiri dengan CSRF dan autentikasi baru. UUID milik orang lain menghasilkan 404.
- POST `/api/v1/auth/logout-all`: cabut semua session, termasuk yang sedang dipakai, dengan CSRF dan autentikasi baru.
- POST `/api/v1/auth/logout`: cabut session saat ini dengan CSRF, tanpa meminta autentikasi baru agar logout tetap mudah.

Pembuatan session keenam mencabut session yang lebih lama. Versi akun diperiksa dan row user dikunci saat membuat session agar perubahan kredensial yang bersamaan tidak menghasilkan session valid dengan versi lama.

## Audit dan log

`TB_AUDIT_LOGS` mencatat pembuatan/perubahan/penghapusan user, kredensial terverifikasi/gagal, pembuatan/pencabutan session, autentikasi ulang, setup/aktivasi/nonaktif MFA, dan pemakaian recovery code. Perubahan user dan audit trigger berada dalam transaksi yang sama. Audit perubahan menyimpan penanda field yang berubah, bukan nilai password/email.

GET `/api/v1/audit-logs?page=1&limit=10` memerlukan izin audit:read, MFA admin bila diwajibkan, dan autentikasi baru. Audit tidak memiliki API update/delete dan trigger menolak UPDATE/DELETE baris. Administrator database tetap dapat menonaktifkan trigger atau menjatuhkan tabel: ini bukan storage anti-manipulasi terhadap pemilik database. Gunakan role migrator terpisah dari runtime, batasi akses database, serta kirim log ke penyimpanan audit eksternal bila perlu jaminan lebih tinggi.

Log HTTP tidak memuat body atau query string dan menyamarkan header rahasia. Error database pada log hanya menyertakan jenis/kode error agar detail baris dan hash password tidak bocor. Request mendapat ID acak pada logger untuk penelusuran.

## Batas dan pengoperasian

- Login: 30 percobaan/IP dan 10/email per 15 menit. Aksi password/reauth/MFA: 10/user per 15 menit. Counter dibagi antarproses melalui PostgreSQL dan key di-HMAC. General API limiter tetap per proses, sehingga gateway/WAF diperlukan untuk batas trafik seluruh deployment.
- Jalankan `npm run auth:cleanup` setiap jam melalui scheduler untuk session, throttle, dan pending enrollment kedaluwarsa.
- Registrasi publik default nonaktif. Belum ada verifikasi email, invitation, reset password via email, passkey/WebAuthn, atau pemeriksaan password terhadap database kebocoran. TOTP membantu saat password bocor, tetapi tidak tahan phishing seperti passkey.
- Employee tersedia; status aktif diperiksa saat login/session. Scope data membatasi Employee ke dirinya sendiri dan Supervisor ke dirinya/tim langsung. Status nonaktif mencabut session. HRD tidak otomatis mendapat hak approval.
- Gunakan `npm ci --omit=dev` untuk image runtime. Jalankan migration melalui job/build yang memasang devDependencies. Tooling migration dipisahkan dari runtime; jangan menjalankan tooling tes dengan input/repository yang tidak dipercaya.
- Audit npm pada pengerjaan ini melaporkan 0 advisory runtime. Audit seluruh dependency masih melaporkan 21 advisory development (3 low, 18 moderate) pada rantai Jest/glob/minimatch/deepmerge dan tooling. Perbaikan kompatibel telah dijalankan; saran force mengubah versi major/downgrade sehingga tidak diterapkan. Pantau perbaikan upstream dan jalankan npm audit berkala.
- Runtime lokal saat pengerjaan memakai Node 22.9.0, sementara requirement dependency meminta >=22.12.0. Tes berhasil pada host tersebut, tetapi gunakan versi yang memenuhi engines untuk deployment.

## Verifikasi

```sh
npm test
RUN_DB_TESTS=1 npm test
npm audit --omit=dev
```

Tes PostgreSQL menggunakan schema sementara yang dibuat dari migration dan dibersihkan setelah selesai. Pengujian mencakup UUID, deny-by-default, MFA/replay/recovery, session lintas-user, expiry/revocation, admin terakhir, dan immutability audit. Ini bukan audit penetrasi independen atau jaminan bebas celah.

Acuan: [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), dan [OTPAuth](https://github.com/hectorm/otpauth).
