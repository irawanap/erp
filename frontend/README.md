# EMP People — Frontend

React + TypeScript + Vite untuk workspace HRD. Tema menggunakan putih, garis abu-abu tipis, dan emerald sebagai warna aksi utama (`#237A55`). Backend tetap menjadi sumber data dan otorisasi.

## Menjalankan

Dari folder frontend:

```sh
nvm use
npm ci --include=optional
cp .env.example .env.local
npm run dev
```

Node.js minimal 22.12. `.nvmrc` di root memilih Node 22 yang tersedia melalui NVM. Bila belum ada, jalankan `nvm install`. Vite memakai port 5173 secara ketat agar sesuai origin backend. Buka **http://localhost:5173**; jangan mengganti localhost menjadi 127.0.0.1 pada satu sisi karena konfigurasi cookie/origin harus konsisten.

Jalankan backend dari terminal terpisah (`cd backend && npm run dev`). `.env.local` frontend menggunakan:

```dotenv
VITE_API_URL=http://localhost:3000/api/v1
VITE_ENABLE_REGISTRATION=false
```

Jika VITE_API_URL tidak diisi, API client memakai `/api/v1` melalui proxy Vite ke localhost:3000. CORS backend perlu mengizinkan http://localhost:5173 saat memakai URL API langsung.

VITE_ENABLE_REGISTRATION hanya mengatur tampilan pendaftaran. Backend tetap memerlukan ENABLE_PUBLIC_REGISTRATION=true untuk menerima register. Default pembuatan akun dikelola HRD. Jangan menaruh secret server pada variable VITE_* karena variable tersebut dikirim ke browser.

## Halaman yang tersedia

| URL | Fungsi |
| --- | --- |
| /login | Email/password, OTP atau recovery code, validasi, pesan server dan retry countdown |
| /register | Form Employee jika diaktifkan; tanpa pemilihan role atau auto-login |
| /auth/mfa | Enrollment manual authenticator, konfirmasi, serta recovery codes sekali tampil |
| / | Dashboard terlindungi: metrik dan pengajuan dari API sesuai role, filter status, pagination |
| /departments | Daftar, pencarian, pagination, tambah/edit departemen untuk HRD/Admin |
| /employees | Daftar, filter dan tambah/edit karyawan sesuai role |
| /employees/:id | Detail karyawan sesuai cakupan akses |
| /leave-balances | Hak tahunan, pemakaian, sisa saldo dan filter sesuai akses; pengaturan khusus HRD/Admin |
| /holidays | Hari libur, pencarian, filter tahun/status, tambah/edit khusus HRD/Admin |
| /leave-types | Daftar, pencarian, filter status dan pengaturan jenis cuti; perubahan khusus HRD/Admin |
| /users | Administrasi akun, role, status dan pengaitan profil; khusus HRD/Admin |
| /account | Informasi akun, session aktif, pencabutan session, logout-all, perubahan password |

Halaman lain menampilkan 404. Menu fitur ERP lain ditandai Segera dan dinonaktifkan; form cuti, approval, dan laporan belum tersedia di frontend.

## Alur autentikasi

1. AuthProvider memanggil /auth/me untuk mengembalikan session setelah reload. Session 401 menjadi anonymous; gangguan jaringan ditampilkan berbeda.
2. Sebelum mutation, API client mengambil /auth/csrf jika token belum ada. Cookie dikirim memakai withCredentials.
3. Login/reauthenticate merotasi cookie dan CSRF. Token CSRF baru diambil dari response, disimpan hanya dalam memori.
4. ProtectedRoute mengarahkan pengguna anonymous ke /login. Role/scope data tetap diperiksa backend.
5. Admin yang mendapat penolakan kebijakan MFA pada dashboard melihat ajakan setup. Setup memakai password saat ini; secret dimasukkan manual ke aplikasi authenticator.
6. Konfirmasi MFA mencabut session. Delapan recovery codes ditampilkan sekali dan bisa diunduh atas tindakan pengguna; simpan di tempat pribadi, bukan repository. Login berikutnya memakai OTP baru atau satu recovery code.
7. Logout hanya menghapus state frontend setelah server berhasil mengakhiri session. Perubahan password dan logout-all juga mencabut akses backend.

Password, cookie, CSRF, secret enrollment, OTP, dan recovery code tidak disimpan pada localStorage/sessionStorage. Jangan menambah mock login atau bypass MFA untuk membuka dashboard.

Pengakhiran session dan perubahan password memakai dialog native dengan verifikasi password/faktor. Reauthentication merotasi current session sebelum mencabut target; jika pengguna memilih session saat ini, frontend mencabut session baru hasil rotasi tersebut.

## Struktur

```text
src/
  app/                  Provider, QueryClient, protected route
  components/common/    Brand, input password, notice
  components/layout/    Sidebar dan header workspace
  features/auth/        API, context, form schema, login/register/MFA
  features/dashboard/   Summary dan daftar pengajuan dari API
  features/account/     Session management dan dialog keamanan
  lib/api.ts            Axios, CSRF, error dan Retry-After
  types/api.ts          Bentuk response API
```

Data server memakai TanStack Query. Query private dipisahkan berdasarkan ID user dan dibersihkan ketika akun berganti/logout. Tidak ada angka dashboard atau pengajuan palsu.

## Pemeriksaan

```sh
npm run build
npm run lint
```

Jika muncul Cannot find native binding, pastikan Node aktif memenuhi requirement lalu jalankan `npm install --include=optional`. Paket native harus sesuai platform, misalnya @rolldown/binding-darwin-arm64 pada Mac Apple Silicon. Pertahankan lockfile.

Kontrak backend tersedia di ../backend/docs/erp-api.md dan ../backend/docs/security.md. Gunakan password akun yang dibuat melalui script admin atau data demo lokal; tidak ada password default di frontend.

## Administrasi Users

Menu Users & akses hanya tersedia untuk HRD/Admin. Pembuatan akun dan pengaitan profil adalah dua tindakan terpisah; jika pengaitan gagal, akun yang sudah dibuat tetap ada. Form edit mengirim hanya email/role yang berubah. Role akun sendiri tidak dapat diubah. Pengaitan profil, aktivasi dan penonaktifan meminta verifikasi password serta MFA jika aktif. Tambah/edit meminta verifikasi ulang jika backend mengembalikan masa verifikasi kedaluwarsa. Penonaktifan menggunakan endpoint DELETE yang menonaktifkan akun, bukan menghapus riwayat. Backend tetap melindungi admin terakhir dan hubungan profil yang tidak valid. Password awal tidak disimpan pada browser storage atau ditampilkan kembali setelah akun dibuat.

## Jenis Cuti

Menu Jenis cuti tersedia untuk semua role yang memiliki akses baca. HRD/Admin dapat menambah dan mengedit kode, nama, penggunaan saldo, serta status aktif. Form edit hanya mengirim field yang berubah. Backend menolak perubahan kebijakan saldo atau status jika masih ada pengajuan Submitted. Jenis cuti tidak dihapus permanen; nonaktifkan melalui form edit. Verifikasi ulang ditampilkan jika masa verifikasi backend habis, dan pembatalan dialog mempertahankan isi form.

## Hari Libur

Menu Hari libur tersedia di /holidays. Filter tahun memakai parameter API year (1900–2200), dikombinasikan dengan search dan isActive sebelum pagination. Biarkan tahun kosong untuk semua tahun. Hari libur aktif dikecualikan dari perhitungan hari kerja cuti. HRD/Admin dapat menambah atau mengedit tanggal, nama dan status. Penghapusan permanen tidak tersedia; gunakan status nonaktif. Mutation memerlukan CSRF dan verifikasi ulang sesuai kebijakan backend.

## Saldo Cuti

Menu Saldo cuti menggunakan GET/PUT /leave-balances. Tahun awal mengikuti kalender Asia/Jakarta dan dapat dikosongkan untuk semua tahun. Pilihan karyawan mengikuti scope backend. HRD/Admin menetapkan total entitlement per karyawan, jenis cuti, dan tahun; operasi ini bukan penambahan saldo. used_days tidak dikirim atau direset. Form edit mengunci identitas karyawan, jenis cuti dan tahun, hanya hak cuti yang diubah. Backend menolak entitlement di bawah pemakaian dan jenis cuti tanpa saldo. Tidak ada reset tahunan otomatis.
