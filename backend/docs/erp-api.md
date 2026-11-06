# Kontrak API ERP untuk frontend

Base URL lokal: `http://localhost:3000/api/v1`. HTTP JSON, request camelCase dan response snake_case. ID akun, karyawan, departemen, jenis cuti, saldo, request, serta keputusan yang keluar API berupa UUID v4. Tanggal kalender `YYYY-MM-DD`; timestamp ISO UTC. UI menampilkan tanggal/waktu sesuai Asia/Jakarta.

## Session dan akses

Gunakan GET /auth/csrf lalu POST /auth/login. Browser mengirim `credentials: 'include'` pada semua fetch. Login/reauthenticate mengganti cookie session dan csrfToken. Simpan CSRF di memori frontend, pasang pada X-CSRF-Token untuk POST/PATCH/PUT/DELETE dan Content-Type application/json. Jangan menyimpan cookie session di localStorage.

Login/me memberikan employee_id UUID publik atau null. Akun yang belum dihubungkan ke employee tetap dapat memakai fungsi admin sesuai izin, tetapi tidak dapat membuat cuti sendiri. HRD menghubungkan akun melalui PATCH /users/:id/employee. Pengaitan/perubahan akun mencabut session target; login ulang diperlukan.

MFA admin sesuai security.md. Aksi HRD terhadap employee/master/balance/link akun, approve/reject Supervisor, dan ekspor laporan memerlukan autentikasi berusia maksimal lima menit. Gunakan POST /auth/reauthenticate dengan currentPassword dan faktor MFA bila aktif, lalu perbarui token CSRF.

| Role | Cakupan data |
| --- | --- |
| Employee | Profil, saldo, dan histori sendiri; membuat/mengubah draft/submit/cancel sendiri |
| Supervisor | Profil/saldo/histori sendiri dan anggota tim langsung; approve/reject request tim yang ditugaskan |
| HRD/Admin | Kelola employee, master, saldo, semua pengajuan untuk pemantauan, dashboard/laporan; tidak otomatis boleh approve |

GET /roles menyediakan matriks izin bagi admin. UI role biasa dapat memakai role dari /auth/me untuk menampilkan menu; backend tetap memeriksa izin dan scope. GET /settings menyediakan enum status, workWeekdays (JavaScript day number, Minggu=0), cancellationStatuses, approvalLevels, dan balanceReservedOnSubmit.

## Employee Management

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | /employees | Daftar sesuai scope; page/limit/search/departmentId/status |
| GET | /employees/:id | Profil yang diizinkan |
| POST | /employees | HRD menambah |
| PATCH | /employees/:id | HRD memperbarui field yang dikirim |
| PATCH | /employees/:id/status | HRD menonaktifkan/mengubah status |
| PATCH | /users/:id/employee | HRD menghubungkan employeeId UUID atau null |

```json
{
  "nik": "EMP006",
  "fullName": "Nama Karyawan",
  "departmentId": "<uuid-departemen>",
  "position": "Staff",
  "supervisorId": "<uuid-karyawan-atasan>",
  "joinDate": "2026-11-01",
  "employmentStatus": "Active"
}
```

supervisorId opsional/null, employmentStatus default Active. Nama dan jabatan wajib, NIK unik uppercase (maksimal 30), nama maksimal 150, jabatan maksimal 100. Atasan harus karyawan aktif dengan akun Supervisor aktif. Siklus hirarki ditolak. PATCH tidak menerapkan default field yang tidak dikirim.

Status: Active, Inactive, Resigned. Nonaktif mencabut akses login akun terkait, tanpa menghapus cuti/histori. Tanggapi 409 penonaktifan dengan meminta HRD mengalihkan tim/menyelesaikan pending atau melepas admin aktif terlebih dahulu.

Field response employee: id, nik, full_name, department_id, department_name, position, supervisor_id, supervisor_name, join_date, employment_status, created_at, updated_at.

## Master dan saldo

| Method | Endpoint | Input/query |
| --- | --- | --- |
| GET | /leave-types | page, limit, search, isActive=true/false |
| GET | /leave-types/:id | Detail |
| POST | /leave-types | code, name, requiresBalance (default true), isActive (default true) |
| PATCH | /leave-types/:id | Field yang diubah |
| GET | /holidays | page, limit, search, isActive, year (1900–2200, opsional) |
| GET | /holidays/:id | Detail |
| POST | /holidays | holidayDate, name, isActive (default true) |
| PATCH | /holidays/:id | Field yang diubah; isActive:false untuk nonaktif |
| GET | /leave-balances | page, limit, employeeId, periodYear; dibatasi scope |
| GET | /employees/:id/leave-balance | page, limit, periodYear |
| PUT | /leave-balances | employeeId, leaveTypeId, periodYear, entitlement |

Semua role boleh membaca master; HRD boleh menambah/mengubah. Saldo dibatasi sendiri/tim/semua sesuai role. Contoh upsert saldo:

```json
{ "employeeId":"<uuid>", "leaveTypeId":"<uuid>", "periodYear":2026, "entitlement":12 }
```

used_days tidak dapat diisi klien. Entitlement tidak boleh lebih kecil dari penggunaan. Jenis cuti tanpa saldo tidak memerlukan row saldo. Response saldo: id, employee_id, full_name, leave_type_id, leave_type_name, period_year, entitlement, used_days, available_days, updated_at. Angka saldo berupa JSON number.

## Leave Management dan Approval

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | /leave-requests | Histori sesuai scope |
| GET | /leave-requests/:id | Detail, working_dates, approvals |
| POST | /leave-requests | Membuat Draft milik akun sendiri |
| PATCH | /leave-requests/:id | Edit Draft sendiri |
| POST | /leave-requests/:id/submit | Draft → Submitted |
| POST | /leave-requests/:id/cancel | Draft/Submitted → Cancelled |
| GET | /approvals/pending | Daftar tugas Supervisor yang ditugaskan |
| POST | /leave-requests/:id/approve | Submitted → Approved |
| POST | /leave-requests/:id/reject | Submitted → Rejected |

Query daftar: page, limit, status, employeeId, departmentId, startDate, endDate. Filter tanggal mencocokkan rentang request yang beririsan. Penggunaan saldo dan laporan memakai working_dates, bukan panjang rentang kalender.

```json
{
  "leaveTypeId":"<uuid>",
  "startDate":"2026-11-23",
  "endDate":"2026-11-25",
  "reason":"Keperluan pribadi"
}
```

Jangan kirim employeeId, totalDays atau status pada body request; backend menentukan identitas, hitungan, dan transisi. Submit/cancel memakai body {}. Approve/reject wajib `{"comment":"Alasan keputusan"}`; komentar maksimal 2000 karakter dan tidak boleh kosong. Alasan cuti juga wajib dan maksimal 2000 karakter.

Response request: id, request_no, employee_id, nik, full_name, department_id, department_name, leave_type_id, leave_type_name, start_date, end_date, total_days, reason, status, approver_id, approver_name, submitted_at, created_at, updated_at. Detail/mutasi juga menyertakan working_dates dan approvals (id, approver_id, approver_name, decision, comment, decided_at).

Approve/reject hanya untuk Supervisor yang ditetapkan saat submit dan masih menjadi atasan langsung. Supervisor tidak dapat memutuskan request sendiri. HRD tidak mewarisi izin approval. Pengajuan Approved tidak dapat dibatalkan atau diedit. Jika request perlu revisi setelah Rejected/Cancelled, buat draft baru.

Backend mengecek saldo, overlap Approved, kalender, dan status di dalam transaksi. Dua approval bersamaan tidak memotong dua kali atau menyebabkan saldo negatif. Klik kedua menghasilkan 409; frontend refresh detail dan saldo. Saat kalender berubah setelah submit, approval dapat menghasilkan 409; pemohon membatalkan lalu mengajukan ulang.

## Dashboard dan reporting

GET /dashboard/summary mengembalikan:

```json
{
  "success":true,
  "data":{
    "activeEmployees":5,
    "employeesByDepartment":[{"department_id":"<uuid>","name":"Operation","total":3}],
    "leaveRequestsByStatus":{"Draft":0,"Submitted":1,"Approved":1,"Rejected":1,"Cancelled":0},
    "pendingApproval":1
  }
}
```

Nilai contoh hanya ilustrasi. HRD melihat seluruh data, Supervisor sendiri/tim, Employee sendiri. pendingApproval HRD adalah semua Submitted; pendingApproval Supervisor hanya tugas keputusan tim; Employee memakai jumlah status Submitted miliknya. Daftar pending terpisah melalui /approvals/pending atau /leave-requests?status=Submitted.

| Method | Endpoint | Query wajib |
| --- | --- | --- |
| GET | /reports/leave-usage | startDate, endDate; departmentId/page/limit opsional |
| GET | /reports/leave-usage/export | startDate, endDate; departmentId opsional |

HRD saja. Rentang laporan maksimal 366 hari. Hanya Approved dan tanggal kerja dalam periode filter yang dihitung. Request yang sebagian masuk periode hanya menyumbang hari kerja pada periode tersebut. Kelompok hasil: employee_id, nik, full_name, department_id, department_name, leave_type_id, leave_type_name, used_days. Department mengikuti data employee saat ini.

CSV memakai UTF-8 BOM, escaping kutip dan proteksi formula injection, serta maksimal 10000 baris hasil; perkecil filter jika melebihi batas. Ekspor dicatat di audit. Header Content-Disposition dan Retry-After diekspos melalui CORS. Contoh unduh:

```js
const query = new URLSearchParams({ startDate: '2026-01-01', endDate: '2026-12-31' });
const response = await fetch(`${apiBase}/reports/leave-usage/export?${query}`, { credentials: 'include' });
if (!response.ok) throw new Error((await response.json()).message);
const url = URL.createObjectURL(await response.blob());
const link = document.createElement('a');
link.href = url;
link.download = 'leave-usage.csv';
link.click();
URL.revokeObjectURL(url);
```

## Response dan error

Daftar memakai `{"success":true,"data":[],"pagination":{"page":1,"limit":10,"total":0,"totalPages":0}}`. Detail/mutasi memakai `{"success":true,"data":{...}}`. POST create 201; operasi lain 200. Page default 1 (maksimal 1000000), limit default 10 (maksimal 100).

| Status | Tindakan UI |
| --- | --- |
| 401 | Session dicabut/habis atau autentikasi baru diperlukan; login/reauthenticate dan ambil CSRF baru |
| 403 | Role/MFA/CSRF tidak memenuhi; jangan mengulang mutation otomatis |
| 404 | UUID tidak ada atau di luar scope |
| 409 | NIK/kode/tanggal duplikat, saldo kurang, overlap, perubahan kebijakan, atau transisi tidak valid; tampilkan message |
| 422 | Input/UUID/tanggal tidak valid; errors berisi field/message |
| 429 | Tunggu Retry-After |
| 500/503 | Gangguan internal/konfigurasi; tampilkan pesan umum |

UI perlu layar login/MFA, dashboard, master departemen/jenis/libur, employee (filter dan form), pengaitan akun, pengelolaan saldo, draft/form cuti, histori/detail, antrean approval, dan laporan/unduh. Gunakan peta requirement [technical-test.md](technical-test.md), [openapi.json](openapi.json), dan Postman lengkap untuk implementasi frontend.
