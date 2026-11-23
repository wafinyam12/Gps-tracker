# Dokumentasi Sales Daily

Mulai dari halaman ini untuk memahami sistem dan menemukan panduan yang masih dipakai. Repository berisi backend Laravel 11 di `gps-tracker/` dan aplikasi React Native dengan Expo SDK 54 di `gps-tracker-mobile/`.

## Mulai bekerja

1. Baca [panduan build dan OTA staging](release/build-staging.md) untuk APK Android, environment EAS, dan publikasi OTA bagi runtime `1.1.5` serta `1.1.6`.
2. Gunakan matriks pemeriksaan pada [rollout visit staging](release/visit-presence-staging-rollout.md) saat memeriksa alur di perangkat.
3. Gunakan [panduan log diagnostik](operations/diagnostic-logs.md) untuk menghubungkan masalah aplikasi dengan log API.

Untuk menjalankan proyek secara lokal:

| Komponen | Lokasi | Langkah awal |
| --- | --- | --- |
| Backend API dan CRM | `gps-tracker/` | PHP 8.2+, `composer install`, salin `.env.example` ke `.env`, atur database, lalu jalankan `php artisan key:generate` dan `php artisan migrate`. |
| Aplikasi Android | `gps-tracker-mobile/` | Node.js, `npm ci`, lalu `npx.cmd expo start`. Untuk APK yang dapat dibagikan, ikuti panduan build staging. |

## Panduan aktif

### Rilis dan pemeriksaan

- [Build Android staging dan OTA dua runtime](release/build-staging.md) — profil EAS, APK, OTA, dan batas dukungan versi lama.
- [Rollout estimasi keberadaan saat visit](release/visit-presence-staging-rollout.md) — urutan backend, migrasi, OTA, pemeriksaan, dan rollback.
- [Handoff visit Area Manager](release/area-manager-visit-staging-handoff.md) — cakupan customer, file backend, dan pemeriksaan staging.

### Operasional dan API

- [Sinkronisasi koordinat customer dari SAP](operations/sap-coordinate-sync.md).
- [Log diagnostik aplikasi dan API](operations/diagnostic-logs.md).
- [Koordinat master toko dan penyegaran CRM otomatis](operations/store-coordinate-management.md).
- [API target harian Area Manager](reference/target-range-api.md).

## Riwayat keputusan

[Desain dan rencana implementasi](history/README.md) menjelaskan alasan perubahan dan langkah yang pernah direncanakan. Dokumen tersebut adalah riwayat pekerjaan; untuk menjalankan rilis gunakan panduan aktif di atas dan periksa status staging terbaru yang tertulis di dalamnya.

Spesifikasi fitur: [pengelolaan koordinat master toko di CRM](superpowers/specs/2026-11-19-store-coordinate-management-design.md).
Spesifikasi tambahan: [customer SAP milik Area Manager](superpowers/specs/2026-11-23-area-manager-own-customers-design.md).

- [Template UAT mobile versi 1.1.0](history/uat/mobile-uat-v1.1.0.md) — contoh kasus uji lama; sesuaikan sebelum digunakan pada APK baru.
- [Pelaksanaan hardening mobile](security/mobile-security-hardening-execution.md) dan [UAT hardening](security/uat-mobile-security-hardening.md) — catatan keamanan dari Oktober 2026.

## Menjaga dokumentasi

Simpan panduan proyek baru di `docs/` pada kategori yang sesuai dan tambahkan tautannya di halaman ini. README di root dan folder aplikasi hanya berfungsi sebagai pintu masuk. `AGENTS.md`, `CLAUDE.md`, dan `LICENSE.md` tetap di lokasi khususnya karena digunakan oleh alat atau berlaku untuk seluruh repository.
