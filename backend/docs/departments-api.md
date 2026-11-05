# Departments API

Base URL lokal: `http://localhost:3000/api/v1`. Tabel: `TB_DEPARTMENT`. Semua ID pada URL/response adalah UUID publik, bukan BIGINT internal.

## Persiapan dan akses

```sh
npm run db:setup
npm run dev
```

Setup menjalankan migration lalu seed OPS/HRD. Seed boleh diulang dan tidak mengubah nama departemen yang sudah ada. Login mengikuti alur CSRF → login → cookie session; admin memakai MFA bila kebijakan mengharuskannya. Browser harus mengirim `credentials: 'include'`.

| Endpoint | Employee | Supervisor | HRD/Admin |
| --- | --- | --- | --- |
| GET `/departments` | Ya | Ya | Ya |
| GET `/departments/:id` | Ya | Ya | Ya |
| POST `/departments` | Tidak | Tidak | Ya |
| PATCH `/departments/:id` | Tidak | Tidak | Ya |

Mutasi memerlukan Content-Type application/json, X-CSRF-Token, dan autentikasi berusia maksimal 5 menit. Jika kedaluwarsa, POST `/auth/reauthenticate` lalu gunakan CSRF baru. Admin yang belum memenuhi kebijakan MFA akan mendapat 403. Role/status/versi actor diperiksa ulang dalam transaksi sebelum perubahan, dan audit dicatat pada transaksi yang sama.

## Daftar dan detail

```http
GET /api/v1/departments?page=1&limit=10&search=operation
GET /api/v1/departments/33333333-3333-4333-8333-333333333333
```

| Query | Aturan |
| --- | --- |
| page | Default 1, minimal 1, maksimal 1000000 |
| limit | Default 10, minimal 1, maksimal 100 |
| search | Opsional, default kosong, maksimal 100 karakter; mencari sebagian kode atau nama tanpa membedakan kapital |

Urutan berdasarkan kode ASC. Karakter `%`, `_`, dan backslash diperlakukan sebagai teks literal. Query lain ditolak dengan 422. Untuk dropdown, ambil daftar dengan limit maksimal 100 dan lanjutkan halaman sesuai pagination jika data lebih banyak.

```json
{
  "success": true,
  "data": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "code": "OPS",
      "name": "Operation",
      "created_at": "2026-11-05T00:00:00.000Z",
      "updated_at": "2026-11-05T00:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

Detail memakai `{"success":true,"data":{...}}`. Halaman kosong tetap 200 dengan data [] dan total yang sesuai.

## Tambah dan ubah

POST `/api/v1/departments`, sukses 201:

```json
{ "code": "QA", "name": "Quality Assurance" }
```

PATCH `/api/v1/departments/:id`, sukses 200:

```json
{ "name": "Quality Control" }
```

Code/nama wajib pada POST. PATCH menerima satu atau keduanya; body kosong, null, dan field lain ditolak. Code di-trim, diubah ke uppercase, maksimal 20 karakter, dan unik. Nama di-trim, wajib tidak kosong, maksimal 100 karakter. updated_at otomatis berubah melalui trigger.

Response create/update berbentuk `{"success":true,"data":{...}}` dengan field yang sama seperti detail. Tidak ada endpoint DELETE atau status aktif pada schema saat ini. Pengelolaan penghapusan/nonaktif perlu kebijakan relasi employee terlebih dahulu.

## Error untuk frontend

| Status | Penanganan |
| --- | --- |
| 401 | Session habis atau autentikasi baru diperlukan; jalankan login/reauthenticate sesuai pesan |
| 403 | Tidak berizin, MFA belum terpenuhi, CSRF/origin salah |
| 404 | UUID valid tetapi data tidak ada |
| 409 | Kode departemen sudah digunakan |
| 415 | Content-Type bukan application/json |
| 422 | Tampilkan errors pada field form; ID angka/UUID tidak valid juga ditolak |
| 429 | Tunggu sesuai Retry-After |
| 500 | Tampilkan pesan gagal umum |

```json
{ "success": false, "message": "Kode departemen sudah digunakan" }
```

```json
{
  "success": false,
  "message": "Validasi gagal",
  "errors": [{ "field": "name", "message": "Nama departemen wajib diisi" }]
}
```

Contoh pemanggilan setelah login:

```js
const response = await fetch(`${apiBase}/departments`, {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify({ code: 'QA', name: 'Quality Assurance' }),
});
const result = await response.json();
if (!response.ok) {
  // Tampilkan result.message dan result.errors pada form.
}
```

Jangan menyimpan session cookie di localStorage. Cookie dikelola browser; CSRF disimpan di memori frontend. Sembunyikan form tambah/ubah untuk Employee/Supervisor, tetapi otorisasi tetap dilakukan backend.

## Postman dan tes

Import `docs/postman/HRD_ERP_Departments.postman_collection.json` bersama environment lokal yang terbaru, atau gunakan folder Departments pada collection utama. Jalankan Auth terlebih dahulu, lalu Departments sesuai nomor. departmentCode dibuat unik dan departmentId disimpan otomatis. Request menambahkan data nyata; pengulangan create menghasilkan departemen baru.

```sh
RUN_DB_TESTS=1 npm test -- department-postgres.test.js
```

Tes menggunakan schema sementara, mencakup seed berulang, pembatasan role/CSRF/MFA, validasi, pencarian literal, pagination, konflik kode, audit, dan pemeriksaan ulang actor.
