# Log Diagnostik

Log diagnostik membantu menghubungkan kegagalan di aplikasi dengan catatan API di server.

## Log server

Laravel menulis log harian di `gps-tracker/storage/logs/laravel-YYYY-MM-DD.log`. Retensi bawaan adalah 14 hari. Atur `LOG_STACK=daily` dan `LOG_DAILY_DAYS=14` pada `.env` server; sesuaikan retensi bila diperlukan. Setelah mengubah konfigurasi, jalankan `php artisan config:cache` sesuai proses deploy aplikasi.

Setiap request ke `/api/v1` dicatat dengan ID request, method, route, aksi controller, ID dan role pengguna jika tersedia, status HTTP, durasi, nama field request, serta nama field validasi. Header `X-Request-ID` dikembalikan oleh server. Request ID yang masuk hanya diterima jika berformat aman; selain itu server membuat ID baru.

## Bagikan log dari aplikasi

1. Buka **Profil Saya**.
2. Tekan **Bagikan log diagnostik**.
3. Pilih aplikasi tujuan, lalu kirimkan log kepada tim support melalui kanal yang disetujui.

Aplikasi menyimpan JSONL secara privat di penyimpanan dokumen aplikasi, maksimal tujuh hari dan 1 MiB. Berbagi hanya terjadi setelah tombol ditekan. Aplikasi tidak mengunggah log secara otomatis. Bila belum ada log, gunakan aplikasi untuk mengulang langkah yang bermasalah lalu bagikan log.

## Menelusuri satu kegagalan

Cari `request_id` dari baris `api.request.completed` di log aplikasi. Cari nilai yang sama di file log Laravel pada tanggal kejadian. Cocokkan juga `method`, `path`, dan `status`. Jika ID pada response berbeda dari ID yang dikirim, log aplikasi menandai `request_id_mismatch`.

Log hanya menyimpan metadata teknis yang dibatasi. Body request/response, password, token, koordinat, nomor telepon, email, nominal pembayaran, isi file/foto, query string, dan signed URL tidak dicatat.
