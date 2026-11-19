# API target harian Area Manager

Fitur ini tersedia untuk akun Area Manager (`spv`) yang memiliki `team_id` dan menggunakan token Sanctum aktif. Semua URL di bawah memakai prefix `/api/v1` dan header `Authorization: Bearer <token>` serta `Accept: application/json`.

## Daftar Sales yang dapat ditarget

`GET /target/eligible-sales`

Respons sukses (200):

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "sales": [
      { "id": 12, "name": "Sales Contoh" }
    ]
  }
}
```

Daftar hanya berisi akun aktif dengan role `sales` pada cabang (`team_id`) milik Area Manager. Parameter cabang dari klien tidak digunakan. Akun tanpa cabang mendapat 403.

## Simpan target untuk satu tanggal atau rentang

`POST /target/range-set`

Contoh untuk Sales tertentu:

```json
{
  "selection": "selected",
  "user_ids": [12, 13],
  "date_from": "2026-11-17",
  "date_to": "2026-11-19",
  "target_visits": 6
}
```

Gunakan `selection: "all"` tanpa `user_ids` untuk semua Sales aktif di cabang Area Manager. Server memilih penerima saat permintaan diproses. Bila `user_ids` tetap dikirim pada mode `all`, nilainya diabaikan.

- `date_from` dan `date_to` memakai format `YYYY-MM-DD`, inklusif, maksimal 31 hari.
- `target_visits` bilangan bulat 1 sampai 100.
- Mode `selected` memerlukan 1 sampai 100 ID unik yang seluruhnya merupakan Sales aktif di cabang Area Manager. ID lintas cabang atau user bukan Sales menyebabkan 403 tanpa menulis target apa pun.
- Daftar penerima kosong atau nilai tidak valid menyebabkan 422.
- Seluruh pasangan Sales dan tanggal disimpan melalui satu transaksi database. Target untuk pasangan yang sudah ada ditimpa dan `set_by` diisi dengan ID Area Manager. Permintaan ulang tidak membuat baris ganda karena tabel `daily_targets` memiliki kunci unik `(user_id, target_date)`.

Respons sukses (201):

```json
{
  "success": true,
  "message": "Target harian berhasil disimpan.",
  "data": {
    "sales_count": 2,
    "days_count": 3,
    "targets_written": 6
  }
}
```

`targets_written` adalah jumlah pasangan Sales dan tanggal yang diproses, termasuk target lama yang diperbarui. Tanggal yang belum pernah diatur masih memakai fallback pilot 5 kunjungan. Endpoint lama `POST /target/set` dan `POST /target/bulk-set` tetap tersedia; keduanya kini menolak penerima yang bukan Sales.

## Pemindahan ke staging

Pindahkan `routes/api.php` dan `app/Http/Controllers/Api/DailyTargetController.php` dari checkout terkini (minimal commit `9bf3e56`) ke path yang sama di backend staging. Tidak ada migration atau dependency baru; tabel `daily_targets` dari fitur target lama tetap dipakai. `tests/Feature/TargetRangeApiTest.php` boleh ikut untuk CI, tetapi tidak diperlukan untuk melayani API.

Jalankan dari folder backend staging:

```bash
php artisan optimize:clear
php artisan route:list --path=target
```

Pastikan route `target/eligible-sales` dan `target/range-set` terlihat. Uji GET dengan token Area Manager uji; pastikan hanya Sales cabang sendiri yang tampil. Sesudah backend siap, barulah OTA mobile target harian diterbitkan ke channel staging runtime 1.1.5.
