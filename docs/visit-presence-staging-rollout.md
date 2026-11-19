# Rilis staging: estimasi waktu kunjungan di radius customer

## Ruang lingkup

Perubahan ini untuk alur kunjungan pada Expo SDK 54. Check-in customer yang **sudah mempunyai titik** wajib berada di radius efektif toko (1–50 m, bawaan 50 m) dengan akurasi GPS tidak lebih buruk dari radius. Customer **tanpa titik** tetap boleh check-in pertama; titik berkualitas (akurasi ≤25 m) menjadi referensi sementara dan baru disimpan ke master setelah checkout melalui alur yang sudah ada. Checkout di luar radius tetap sukses dan target visit tidak berubah.

Estimasi waktu dalam/luar radius berasal dari pasangan sampel GPS konsisten yang berjarak paling lama 150 detik. Titik ragu dan jeda panjang masuk `unmeasured_seconds`; angka ini bukan bukti keberadaan setiap detik atau di dalam bangunan. Android dapat menunda callback dan dapat menghentikan tugas lokasi jika aplikasi ditutup paksa.

## File backend yang perlu dipindah

Salin perubahan fitur dari folder `gps-tracker` ke lokasi relatif yang sama di staging:

1. `database/migrations/2026_11_17_000000_add_radius_audit_to_visit_logs_table.php`
2. `database/migrations/2026_11_17_000001_create_visit_location_samples_table.php`
3. `app/Models/VisitLog.php`, `app/Models/VisitLocationSample.php`
4. `app/Services/VisitGeofenceService.php`, `app/Services/VisitPresenceEstimator.php`, `app/Services/VisitPresenceSummaryService.php`
5. `app/Support/VisitAuditFormatter.php`
6. `app/Http/Controllers/Api/CheckInController.php`, `app/Http/Controllers/Api/VisitLogController.php`, `app/Http/Controllers/Api/VisitMonitoringController.php`, `app/Http/Controllers/Api/VisitLocationSampleController.php`, `app/Http/Controllers/Api/LocationController.php`
7. `app/Services/MasterData/StoreCatalogSyncService.php`, `app/Services/Crm/CrmAnalyticsService.php`, `app/Services/Sap/BpCoordinateService.php`
8. Perubahan fitur pada `routes/api.php`, `routes/console.php`, dan `resources/views/crm/dashboard.blade.php`.

`routes/console.php` dan dashboard CRM mengandung perubahan lain yang sudah ada di workspace sebelum fitur ini. **Gabungkan hunk fitur**, jangan menimpa versi staging tanpa membandingkan file. Retensi sampel membutuhkan perintah terjadwal `visits:prune-location-samples`; pastikan cron Laravel `schedule:run` yang sudah ada tetap aktif. Tidak ada perubahan `composer.json`, `composer.lock`, `package.json`, `app.json`, atau dependency native untuk fitur ini. Tes pada folder `tests` tidak diperlukan saat menyalin aplikasi ke staging, tetapi jalankan pada lingkungan tes lokal.

## Urutan deploy backend

1. Backup database staging dan catat commit/versi file yang berjalan. Salin file backend di atas bersama-sama; hindari waktu ketika Sales sedang checkout.
2. Di SSH staging jalankan `php artisan migrate --force`. Dua migrasi aditif harus berstatus `Ran` di `php artisan migrate:status`.
3. Jalankan `php artisan optimize:clear`, lalu `php artisan route:list --path=visits` dan pastikan `POST api/v1/visits/{visitLog}/samples` muncul. Periksa juga `php artisan list --raw` untuk `visits:prune-location-samples`.
4. Baca satu visit lama melalui akun berizin: durasi historis tetap tampil, `presence.status` adalah `legacy_unverified`. Jangan memodifikasi akun Sales 1 nyata untuk smoke test.
5. Siapkan Sales dan customer **dummy** pada cabang AM uji sebelum tes transaksi staging. Tanpa data dummy, hentikan uji tulis staging dan pakai hasil tes database lokal.
6. Setelah backend dinyatakan siap, terbitkan **satu OTA staging SDK 54** untuk perubahan JavaScript mobile dari folder `gps-tracker-mobile` dengan `npx eas-cli update --channel staging --environment preview --platform android --message "Visit radius, presence, dan marker SDK 54"`. Pastikan environment `preview` mengarah ke API staging dan update ditujukan pada runtime aplikasi 1.1.5. Izin lokasi latar belakang dan foreground service pada APK Infinix sudah terverifikasi; jika perangkat pilot lain memakai APK berbeda, periksa manifestnya sebelum OTA. Panduan resmi: https://docs.expo.dev/eas-update/getting-started/.

## Kontrak API baru

`POST /api/v1/visit/start` menerima tambahan opsional `captured_store_latitude`, `captured_store_longitude`, `captured_store_radius`, dan `captured_store_has_location` untuk menandai perubahan master selama offline. Nilai dari HP hanya konteks audit, bukan otoritas master. Untuk toko yang sudah bertitik, check-in online di luar radius/GPS lemah mendapat HTTP 422. Customer tanpa koordinat tetap mendapat HTTP 201.

`POST /api/v1/visit/checkout` tetap menerima payload lama. Respons dan `GET /api/v1/visits/{id}` menambah `checkin_radius_status`, `checkout_radius_status`, `checkout_latitude`, `checkout_longitude`, `checkout_accuracy`, `checkout_distance`, `geofence_radius_meters`, `geofence_reference_source`, `duration_verification_status`, dan `presence`.

`POST /api/v1/visits/{id}/samples` hanya untuk pemilik visit (Sales yang check-in). Body:

```json
{
  "samples": [
    {
      "client_uuid": "12345678-1234-4123-8123-000000000001",
      "latitude": -6.2,
      "longitude": 106.8,
      "accuracy": 10,
      "is_mock_location": false,
      "recorded_at": "2026-11-17T09:01:00+07:00"
    }
  ],
  "final_batch": true
}
```

Maksimal 100 sampel per batch. Server memverifikasi kepemilikan, waktu dalam sesi dan dalam 3 hari, koordinat, akurasi, serta flag mock. UUID yang sama dengan isi sama aman dikirim ulang; UUID dengan isi berbeda mendapat 409. Server menghitung status radius, bukan HP. Respons `data.summary`:

Jika Android tidak memberikan sampel sama sekali, klien mengirim `{"samples":[],"final_batch":true}` agar sesi ditutup dengan seluruh durasi sebagai `unmeasured_seconds`. Batch kosong tanpa `final_batch:true` ditolak.

```json
{
  "inside_seconds": 600,
  "outside_seconds": 120,
  "unmeasured_seconds": 480,
  "status": "complete"
}
```

Sebelum batch terakhir tersinkron statusnya `provisional`; visit lama `legacy_unverified`. Daftar visit dan ringkasan AM hanya memberi angka/status. Titik checkout berada pada detail visit yang telah lolos pemeriksaan akses cabang. API tidak menyediakan pembacaan sampel mentah. Sampel mentah dihapus sesudah 30 hari melalui scheduler, sedangkan ringkasan tetap tersimpan.

## Matriks uji staging

| Skenario dummy | Harapan |
| --- | --- |
| Customer tanpa titik, GPS akurasi ≤25 m | Check-in pertama berhasil; pusat sementara tercatat. |
| Customer bertitik, Sales dalam radius | Check-in berhasil dan dihitung sesuai aturan duplikat. |
| Customer bertitik, Sales di luar radius / akurasi buruk | Check-in online ditolak 422, tidak ada visit baru. |
| Checkout di luar radius | Visit selesai; koordinat checkout dan status luar terlihat oleh AM cabang yang sama. |
| Layar dikunci ketika visit aktif | Notifikasi layanan tetap ada; titik baru tersimpan/terkirim saat Android memberi callback. Jeda yang hilang tampil tidak terukur. |
| Internet mati, lalu pulih | Sampel berada di SQLCipher dan terkirim tanpa duplikasi; status berubah dari provisional ke complete. |
| AM cabang lain membuka ID visit | HTTP 403, tidak ada koordinat yang bocor. |
| Sales dan Superadmin membuka peta | Marker tampil di atas peta; log `map.webview_update_failed`/`map.marker_count_mismatch` kosong. |

## Ukur baterai pada Infinix

Gunakan HP, kondisi Wi-Fi/data, lokasi, dan durasi yang sama untuk dua sesi: (A) pelacakan umum sekitar 5 menit `Balanced` tanpa visit, (B) visit dummy aktif sekitar 1 menit `High`. Masing-masing minimal 60 menit, tidak sambil mengisi daya. Catat jam, persentase baterai awal/akhir, suhu/keluhan panas, apakah layar terkunci, jumlah sampel yang masuk, jeda terbesar, dan `unmeasured_seconds`. Ambil tangkapan Android **Setelan → Baterai → Penggunaan baterai** sebelum/sesudah. Bila ADB tersedia, `adb shell dumpsys battery` dan `adb shell dumpsys batterystats` membantu membaca kondisi tanpa mereset statistik. Bandingkan penurunan persen per jam; jika kenaikan besar atau HP panas, uji interval 2–3 menit/akurasi adaptif pada tahap berikutnya dan terima tambahan waktu tidak terukur.

## Rollback

Hentikan OTA baru pada channel staging dan pulihkan bundle SDK 54 sebelumnya. Backend aditif dapat dibiarkan sementara agar kunjungan lama tetap aman; jika perlu rollback backend, pulihkan file aplikasi versi sebelumnya setelah memastikan tidak ada permintaan sampel aktif. Jangan menjalankan `migrate:rollback` sebelum menyimpan data visit yang sudah memakai kolom baru. Simpan backup dan koordinasikan rollback data bila migrasi harus dibatalkan.

## Verifikasi saat disiapkan

- Seluruh suite backend lokal pada database tes terisolasi: **82 lulus, 502 assertion**. Empat kegagalan yang sebelumnya terlihat sudah ditangani: respons 404 SAP BP yang normal, fixture reassignment SAP, field `members_count` monitoring, dan fixture Cash Payment yang perlu mengaktifkan flag hanya di dalam tes. Fitur Cash Payment aplikasi tetap dimatikan.
- Rute sampel dan perintah retensi muncul pada `artisan route:list`/`artisan list`.
- Tes mobile Node: 75 lulus; ekspor Android SDK 54 berhasil. `git diff --check` bersih. Perbaikan tipografi pemisah waktu pada `VisitFormScreen.js` dibuat setelah OTA di bawah, sehingga belum termasuk di dalamnya.
- ADB terhubung ke Infinix X6525B, Android 13. APK staging yang terpasang versi 1.1.5, `versionCode` 8; izin lokasi latar belakang, lokasi presisi, dan foreground service ada serta lokasi latar belakang sudah diberikan. Layanan `LocationTaskService` tampak aktif sebagai foreground service. Ini mendukung OTA JavaScript tanpa perubahan native untuk APK tersebut.
- Pada akun Sales 1 di APK staging, daftar toko yang memiliki tombol rute memperlihatkan radius 50 m. Peta menampilkan jalan dan informasi 14 toko berkoordinat tetapi marker tidak tampil. Penyebab di source ditemukan: fungsi `safeColor` dipanggil dalam JavaScript WebView tanpa didefinisikan di lingkup WebView; perbaikan lokal dan tesnya lulus. Marker sesudah OTA belum diverifikasi.
- Pembacaan baterai awal saat pemeriksaan: 53%, sekitar 31 °C, tidak sedang diisi daya, dan layanan latar belakang aktif. Ini **bukan** hasil uji konsumsi baterai; perbandingan 60 menit tanpa visit versus visit dummy masih menunggu staging dan data uji.
- Pada 18 November pengguna melaporkan check-in dan checkout di staging berhasil. Migrasi serta route sampel di server belum saya periksa langsung melalui SSH.
- OTA Android ke channel/branch `staging`, runtime `1.1.5`, berhasil terbit sebagai group `dc7fd6fc-6667-4fee-9471-c66c21396a85`. Hash bundle OTA cocok dengan ekspor source lokal sebelum perbaikan tipografi kecil. EAS kemudian menunjukkan 1 pemasangan dan 0 gagal. Pada pemeriksaan awal layar Infinix masih menampilkan bundle lama; satu kunjungan baru sedang aktif, jadi jangan memaksa restart sampai selesai. Setelah visit selesai, buka ulang dan periksa bagian “Waktu di area customer” serta marker peta.
- Uji layar terkunci selama visit, sinkronisasi offline, marker setelah OTA aktif, dan estimasi waktu pada perangkat belum diklaim berhasil. Saya tidak membuat transaksi uji pada akun Sales 1 nyata; kunjungan yang terlihat di HP dibuat oleh pengguna.
