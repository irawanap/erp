# Struktur backend

Kode dikelompokkan berdasarkan fitur. Perubahan pengelolaan user biasanya cukup membuka `src/modules/users`, tanpa mencari file di beberapa folder global.

## Modul yang tersedia

| Folder | Tanggung jawab |
| --- | --- |
| `src/modules/auth` | Login/register, validasi kredensial, MFA, session, throttle autentikasi |
| `src/modules/users` | Membuat, mencari, mengubah, dan menonaktifkan akun |
| `src/modules/access` | Daftar role dan matriks izin |
| `src/modules/audit` | Menulis serta membaca aktivitas audit |
| `src/modules/employees` | Profil karyawan, hirarki atasan, status, pengaitan akun |
| `src/modules/leave-types`, `holidays` | Master cuti dan kalender |
| `src/modules/leave-balances` | Entitlement tahunan dan saldo sesuai scope |
| `src/modules/leave-requests`, `approvals` | Draft, submit, cancel, approve/reject dan histori |
| `src/modules/dashboard`, `reports` | Ringkasan sesuai scope, laporan periode/departemen, CSV |
| `src/shared/middlewares` | Pemeriksaan request yang dipakai lintas modul |
| `src/shared/validators` | Schema umum yang dipakai beberapa modul |
| `src/shared/utils` | Error HTTP dan transaksi database |

Konfigurasi tetap berada di `config`. Migration tetap satu urutan di `database/migrations` agar dependensi tabel lintas modul jelas. Script operasional tetap di `scripts`. `src/routes.js` hanya mendaftarkan route modul; `src/app.js` memasang middleware global dan penanganan error.

## Isi satu modul

Contoh users:

```text
modules/users/
  user.routes.js
  user.controller.js
  user.service.js
  user.model.js
  user.validation.js
```

- **Routes:** URL, method HTTP, serta urutan middleware akses dan CSRF.
- **Controller:** membaca request, memanggil service, dan membentuk response HTTP.
- **Service:** menjalankan aturan bisnis, validasi input, dan koordinasi proses.
- **Model:** query PostgreSQL dan konsistensi perubahan data dalam transaksi; tidak menerima req/res.
- **Validation:** schema Zod khusus fitur.

Auth memiliki file tambahan session/MFA karena keduanya bagian autentikasi. Kode crypto khusus MFA dan token session tetap di auth, bukan shared. Access tidak memiliki service/model karena saat ini hanya menampilkan konfigurasi role. Audit controller memvalidasi pagination dan membaca model langsung karena belum ada aturan bisnis tambahan.

## Pola penambahan modul (contoh employees)

Modul employees sudah tersedia. Untuk modul baru lain, ikuti struktur berikut dengan nama fitur yang sesuai:

```text
employee.routes.js
employee.controller.js
employee.service.js
employee.model.js
employee.validation.js
```

Daftarkan route pada `src/routes.js`:

```js
router.use('/employees', require('./modules/employees/employee.routes'));
```

Di `employee.routes.js`, pasang middleware yang sesuai, lalu teruskan ke controller:

```js
const router = require('express').Router();
const controller = require('./employee.controller');
const { requireAuth } = require('../../shared/middlewares/authenticate');
const { requirePermission } = require('../../shared/middlewares/authorize');
const { requireCsrf } = require('../../shared/middlewares/csrf');

router.use(requireAuth);
router.get('/', requirePermission('employees:read'), controller.list);
router.post('/', requireCsrf, requirePermission('employees:write'), controller.create);

module.exports = router;
```

Contoh tersebut baru dapat dipakai setelah controller dibuat dan izin employees ditambahkan secara eksplisit ke `modules/access/roles.js`. Jangan menyalin izin users untuk semua role. Pemeriksaan kepemilikan profil atau cakupan tim perlu dilakukan pada service/query employee, bukan hanya pemeriksaan role di route.

Buat migration melalui `npm run db:create-migration -- nama-perubahan`, lalu tempatkan tes di `tests/employees`. Gunakan pola query berparameter serta respons/error yang sudah dipakai users. Modul employees sekarang sudah diimplementasikan; gunakan pola tersebut untuk modul baru lain.

## Batas antarbagian

- Simpan logika khusus fitur dalam modulnya. Pindahkan ke shared hanya bila memang digunakan oleh beberapa modul.
- Gunakan service modul lain saat membutuhkan proses bisnisnya. Jangan memanggil controller dari controller lain.
- Middleware autentikasi/CSRF bersama boleh menggunakan mekanisme session auth. Model auth/users juga memakai pencatat audit untuk perubahan keamanan; dependensi lintas modul tersebut merupakan infrastruktur yang sudah digunakan.
- Schema email/password/UUID/pagination memakai `shared/validators/common.js`, sehingga auth dan audit tidak bergantung pada schema users.
- Jangan membuat registry model global, base controller, atau lapisan repository tambahan sebelum ada kebutuhan konkret.
- Database audit/constraint tetap menjaga konsistensi walaupun ada perubahan dari script operasional.

## Pengujian

```sh
npm test
RUN_DB_TESTS=1 npm test
```

Tes berada per fitur. `tests/helpers/database.js` membuat schema PostgreSQL sementara dan menjalankan migration untuk pengujian integrasi. Test lintas auth/role/users berada di `tests/access/access-postgres.test.js` karena memeriksa batas akses antarmodul.

Refactor folder ini tidak mengubah endpoint, kontrak respons, nama tabel, maupun data database. Tidak ada migration baru yang diperlukan untuk perpindahan folder.

## Transaksi ERP

`shared/utils/business.js` menyediakan context user internal dari session, scope employee, pagination, dan transaksi tulis HR/cuti. Nama tabel reference di-whitelist; nilai request tetap memakai parameter SQL. Transaksi memeriksa ulang role/status/auth_version actor dan mengambil satu advisory lock workflow sebelum mengubah organisasi, kalender, saldo, atau request. Penggunaan lock bersama sengaja sederhana untuk technical test; transaksi singkat dan tidak melakukan network call eksternal.

Kolom BIGINT dipakai hanya untuk relasi internal; UUID pada response tidak digunakan sebagai pengganti pemeriksaan akses. `shared/validators/hr.js` menyediakan date, year dan schema partial tanpa menerapkan default create pada PATCH.
