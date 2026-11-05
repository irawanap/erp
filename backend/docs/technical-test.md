# Acuan technical test HRD Web Based ERP

Acuan utama: **TECHNICAL TEST HRD WEB BASED ERP-1.pdf** yang diberikan pengguna. Excel sebelumnya dipakai sebagai rancangan tambahan. Implementasi backend mengikuti empat modul wajib PDF; frontend belum dibuat.

## Pemetaan requirement

| Requirement PDF | Implementasi backend |
| --- | --- |
| Tambah/edit/lihat/nonaktif karyawan | /employees dan /employees/:id/status |
| NIK, nama, departemen, jabatan, atasan, tanggal masuk, status | TB_EMPLOYEES, validasi wajib, NIK unique |
| Pencarian/filter departemen/status | Query search, departmentId, status pada GET /employees |
| Pengajuan tanggal mulai/selesai dan alasan | Draft melalui POST /leave-requests, dilanjut submit |
| Hitung hari kerja | Kalender WORK_WEEKDAYS dan TB_HOLIDAYS; perhitungan backend |
| Saldo dan histori | GET /leave-balances, /employees/:id/leave-balance, /leave-requests |
| Tidak melebihi saldo | Validasi create/edit/submit dan pemeriksaan ulang saat approval |
| Tidak overlap dengan Approved | Pemeriksaan rentang inklusif untuk karyawan yang sama saat create/submit/approve |
| Approve/reject anggota tim | Supervisor dengan approver assignment dan atasan langsung yang masih sesuai |
| Catat pemberi approval, waktu, status, komentar | TB_LEAVE_APPROVALS; komentar wajib nonkosong pada approve dan reject |
| Tidak approve diri sendiri | Pemeriksaan eksplisit pada transaksi |
| Saldo terpotong tepat sekali | Transaksi database, lock workflow dan pengecekan status Submitted; percobaan kedua ditolak |
| Draft/Submitted/Approved/Rejected/Cancelled | Transisi eksplisit; tidak menerima status buatan klien |
| Total aktif dan jumlah per departemen | GET /dashboard/summary dengan scope role |
| Jumlah pengajuan per status | leaveRequestsByStatus pada dashboard |
| Daftar menunggu approval | /approvals/pending untuk Supervisor; HRD dapat memakai /leave-requests?status=Submitted |
| Laporan periode dan departemen | /reports/leave-usage?startDate=...&endDate=...&departmentId=... |
| CSV atau Excel | CSV UTF-8 dipilih; Excel/XLSX tidak diperlukan untuk memenuhi alternatif PDF |
| Role HRD/Admin, Supervisor, Employee | Matriks izin backend dan scope profil/tim/seluruh perusahaan |
| Lima karyawan simulasi dan saldo awal 12 | npm run db:seed:demo; saldo entitlement 12 per karyawan/tahun |

Semua endpoint pada tabel memakai prefix `/api/v1`.

## Kebijakan yang disetujui pengguna

- Hari kerja Senin–Jumat, dapat dikonfigurasi melalui WORK_WEEKDAYS. Hari libur aktif dikecualikan.
- Approval satu tingkat oleh atasan langsung yang memiliki akun Supervisor aktif.
- HRD mengisi entitlement per tahun; tidak ada reset/penambahan tahunan otomatis.
- Saldo available = entitlement - used_days. Submitted tidak mereservasi saldo; approval memeriksa ulang sehingga dua request yang masing-masing lolos submit tidak dapat menyebabkan saldo negatif.
- Pembatalan hanya Draft/Submitted. Approved tidak dapat dibatalkan/refund melalui API ini.
- Pengajuan lintas tahun harus dipecah menjadi dua agar pembebanan saldo tahunan jelas. Permintaan full-day saja; tidak ada cuti setengah hari.
- Tanggal tidak boleh sebelum tanggal masuk. Tidak ada larangan pengajuan historis tambahan karena PDF tidak menetapkannya.
- Rejected/Cancelled bersifat final; pengguna membuat draft baru jika ingin mengajukan lagi.
- Mengubah hari libur setelah submit dapat mengubah hasil hitungan. Approval menolak jika working_dates berubah; pemohon membatalkan dan membuat request baru.
- Pemindahan atasan diblokir jika karyawan masih memiliki Submitted. Penonaktifan diblokir jika masih ada tim aktif/pengajuan pending terkait atau akun admin aktif yang terhubung; selesaikan/alihkan terlebih dahulu.
- Laporan penggunaan dihitung dari working_dates milik Approved dalam periode filter, dikelompokkan berdasarkan departemen karyawan saat laporan dibaca. Histori perpindahan departemen belum merupakan requirement PDF.

## Data demo

| NIK | Nama | Departemen | Jabatan | Atasan | Entitlement |
| --- | --- | --- | --- | --- | --- |
| EMP001 | Andi Saputra | Operation | Staff | Budi Santoso | 12 |
| EMP002 | Budi Santoso | Operation | Supervisor | — | 12 |
| EMP003 | Citra Lestari | HRD | Staff | Dewi Anggraini | 12 |
| EMP004 | Dewi Anggraini | HRD | Manager | — | 12 |
| EMP005 | Eko Pratama | Operation | Staff | Budi Santoso | 12 |

Budi dan Dewi memiliki role Supervisor agar dapat memproses tim masing-masing. Akun HRD/Admin demo terpisah dan tidak otomatis menjadi approver. Tiga request demo disediakan untuk Submitted, Approved, dan Rejected; contoh Approved Eko sudah mengurangi used_days dua hari sehingga available menjadi 10, sementara entitlement awal tetap 12.

## Menyiapkan demonstrasi

```sh
cd backend
npm run db:setup
npm run db:seed:demo
npm run dev
```

Perintah demo hanya untuk development/test dan ditolak pada NODE_ENV=production. Password acak dibuat untuk akun baru dan ditulis ke `.demo-accounts.json` dengan izin file 600. File di-ignore oleh Git; jangan diunggah, dikirim melalui chat, atau disertakan dalam arsip. Ini kredensial awal untuk demonstrasi; perubahan password sesudahnya tidak disinkronkan ke file tersebut.

Seed boleh diulang: tidak menggandakan NIK/email, tidak mereset password/hak cuti yang telah ada, dan tidak memotong used_days demo lagi. Pengulangan pada tahun berbeda membuat entitlement tahun tersebut serta request demo bernomor tahun baru. Seed tidak menimpa perubahan data existing; pada database yang sudah dipakai, konflik data existing perlu ditinjau HRD.

Login HRD/Admin membutuhkan enrollment MFA sesuai kebijakan keamanan. Kredensial demo Employee/Supervisor dapat digunakan untuk alur cuti; jangan menonaktifkan kebijakan MFA production demi demo.

## Cakupan yang tersisa

Empat modul wajib backend tersedia; layar/frontend, pengalaman pengguna, dan pengujian UI belum dibuat. Fitur di luar PDF seperti payroll, attendance, email verification, reset password email, atau passkey belum menjadi bagian implementasi ini. Konfigurasi deployment, backup, monitoring dan pemulihan MFA tetap mengikuti panduan keamanan.

Acuan teknis frontend: [erp-api.md](erp-api.md), [openapi.json](openapi.json), dan collection `postman/HRD_ERP_Complete.postman_collection.json`.
