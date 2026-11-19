# Rencana hardening keamanan mobile untuk Play Store

Tanggal: 2026-10-05

## Tujuan

Menutup risiko keamanan pada aplikasi GPS Tracker mobile dan jalur API/backend yang relevan sebelum rilis Play Store. Rencana ini hanya untuk peninjauan; belum ada kode aplikasi yang diubah.

## Batasan dan keputusan

- URL/environment staging sengaja dikesampingkan sesuai arahan pengguna. Tidak ada perubahan konfigurasi staging atau pemindahan ke production dalam pekerjaan ini.
- Versi aplikasi dan dependency tidak dinaikkan. Perubahan versi hanya dibahas jika temuan dependency yang terverifikasi mengharuskannya.
- Working tree saat ini sudah berisi perubahan pengguna pada beberapa file mobile/backend. Saat implementasi, perubahan tersebut harus dipertahankan dan diperiksa sebelum mengedit file yang sama.
- Jangan menyimpan token, header Authorization, payload, koordinat, data foto, atau data pribadi di log.
- CustomerKycScreen belum terlihat terdaftar di navigator utama saat audit; perlakukan sebagai kode dormant dan pastikan status route sebelum mengubah alurnya.

## Urutan prioritas

1. **P0 — Hentikan kebocoran data lewat log.** Error Axios mentah bisa menyertakan request config/header dan response/payload.
2. **P0 — Disclosure dan izin pelacakan lokasi background.** Tracking saat ini dimulai otomatis setelah autentikasi, tanpa disclosure aplikasi yang eksplisit sebelum permintaan izin.
3. **P1 — Token dan sesi.** Token Sanctum tidak memiliki expiry konfigurasi; perubahan password belum mencabut token lain. Perlu kebijakan masa berlaku dan alur mobile yang kompatibel.
4. **P1 — Data offline dan foto lokal.** Queue/draft disimpan di AsyncStorage dan file persisten; logout hanya membersihkan kredensial.
5. **P1 — JavaScript peta dan WebView bridge.** Library peta dimuat dari CDN jarak jauh dalam WebView yang memiliki JavaScript dan bridge.
6. **P1 — Pastikan foto kunjungan privat.** Konfigurasi default disk lokal menggunakan visibility publik; verifikasi deployment dan batasi akses.
7. **P2 — Permission Android dan bukti rilis.** Tinjau permission yang tidak digunakan dan verifikasi manifest final dari AAB.
8. **P2 — Dependency dan checklist Play Store.** Jalankan audit dependency di lingkungan CI dengan akses registry dan cocokkan Data Safety/privacy disclosure dengan aliran data aktual.

## Rencana implementasi

### Fase 1 — Sanitasi logging

**File utama**
- `gps-tracker-mobile/src/utils/offlineQueue.js` (terutama sekitar baris 299, 385, 452, 528)
- `gps-tracker-mobile/src/utils/offlineSyncTask.js` (sekitar baris 13, 35)
- `gps-tracker-mobile/src/utils/diagnosticLogger.js`

**Callsite lain untuk ditinjau**
- `gps-tracker-mobile/src/screens/HomeScreen.js`
- `gps-tracker-mobile/src/screens/admin/StoreListScreen.js`
- `gps-tracker-mobile/src/screens/StartVisitScreen.js`
- `gps-tracker-mobile/src/screens/MySummaryScreen.js`
- `gps-tracker-mobile/src/screens/MyLocationScreen.js`
- `gps-tracker-mobile/src/screens/spv/LiveMapScreen.js`
- `gps-tracker-mobile/src/screens/spv/TeamSummaryScreen.js`
- `gps-tracker-mobile/src/screens/spv/AlertListScreen.js`
- `gps-tracker-mobile/src/utils/authEvents.js`
- `gps-tracker-mobile/src/hooks/useLocationTracker.js`
- Jika route KYC digunakan: `gps-tracker-mobile/src/screens/CustomerKycScreen.js`

**Perubahan yang direncanakan**
- Ganti log error mentah dengan event terstruktur dari diagnostic logger yang hanya menerima nama operasi, status HTTP, dan kode error yang diizinkan.
- Pastikan logger tidak menyimpan `error.message`, `error.config`, request/response body, URL berparameter sensitif, token, koordinat, atau nama file/foto.
- Pertahankan informasi yang cukup untuk diagnosis: correlation/request ID bila tersedia, endpoint template tanpa query sensitif, status, dan kategori kegagalan.
- Tetapkan retensi dan batas ukuran log; uji ekspor log agar data rahasia tidak ikut terbawa.

**Verifikasi**
- Simulasikan kegagalan jaringan dan HTTP 4xx/5xx; inspeksi log tersimpan dan pastikan token/payload/PII tidak muncul.

### Fase 2 — Disclosure dan kontrol background location

**File utama**
- `gps-tracker-mobile/src/context/AuthContext.js` (sekitar baris 60–85: pemicu tracking setelah user dipulihkan/login)
- `gps-tracker-mobile/src/utils/backgroundTracker.js` (sekitar baris 33–62 dan 69–95)
- `gps-tracker-mobile/src/api/services/locationService.js`
- `gps-tracker-mobile/app.json`
- Tambahkan komponen/screen disclosure dan tautan kebijakan privasi pada navigasi yang sesuai.

**Perubahan yang direncanakan**
- Petakan role dan fungsi yang benar-benar membutuhkan lokasi saat aplikasi tertutup.
- Tampilkan disclosure Bahasa Indonesia di alur normal sebelum dialog izin OS: tujuan, kapan lokasi dikirim, data yang dikirim, dan cara menolak/menonaktifkan. Minta tindakan afirmatif; jangan mulai tracking otomatis hanya karena login.
- Minta foreground permission lebih dahulu, lalu jelaskan perpindahan ke Settings sebelum background permission Android 11+.
- Jika pengguna menolak, aplikasi tetap dapat digunakan untuk fungsi yang tidak memerlukan tracking; jangan masuk loop meminta izin.
- Tautkan privacy policy di dalam aplikasi dan siapkan kecocokan teks dengan listing Play Store serta deklarasi Data Safety.

**Verifikasi**
- Uji first launch, setuju, tolak, izin dicabut dari Settings, login ulang, dan role yang tidak memerlukan background tracking.
- Pastikan tidak ada ping lokasi sebelum disclosure dan izin yang sesuai.

### Fase 3 — Token, perubahan password, dan sesi

**File utama**
- `gps-tracker/config/sanctum.php` (sekitar baris 53: `expiration` saat ini `null`)
- `gps-tracker/app/Http/Controllers/Api/AuthController.php` (sekitar baris 114: `changePassword`; juga endpoint refresh)
- `gps-tracker-mobile/src/api/client.js` (token request/interceptor dan pembersihan sesi)
- `gps-tracker-mobile/src/context/AuthContext.js`
- Route/API auth terkait di `gps-tracker/routes/api.php` (pastikan nama file/route aktual sebelum implementasi)

**Perubahan yang direncanakan**
- Tetapkan kebijakan expiry/revocation bersama backend dan mobile. Jangan mengaktifkan expiry pendek sebelum alur refresh atau re-login mobile siap.
- Saat password diganti, cabut token sesuai kebijakan (minimal token aktif atau seluruh token pengguna); berikan respons yang membuat aplikasi menghapus sesi dengan benar.
- Pastikan refresh (jika dipakai) aman terhadap request bersamaan, menangani kegagalan, dan tidak menulis token ke log.
- Dokumentasikan perilaku logout, ganti password, token kedaluwarsa, dan perangkat lain.

**Verifikasi**
- Uji token valid/kedaluwarsa/dicabut, ganti password dari perangkat aktif dan perangkat lain, serta refresh yang gagal.

### Fase 4 — Proteksi antrean offline dan file lokal

**File utama**
- `gps-tracker-mobile/src/utils/offlineQueue.js` (AsyncStorage, file foto, kepemilikan antrean, `clearQueue` sekitar baris 574)
- `gps-tracker-mobile/src/context/AuthContext.js` (logout sekitar baris 46–55)
- `gps-tracker-mobile/src/api/client.js` (identitas pemilik antrean dan token)
- `gps-tracker-mobile/app.json` (aturan Android backup)
- Jika KYC route aktif: `gps-tracker-mobile/src/screens/CustomerKycScreen.js` (draft sekitar baris 285 dan 560–573)

**Perubahan yang direncanakan**
- Jangan menaruh bearer token/header pada item antrean; tambahkan kredensial hanya pada saat replay.
- Pertahankan isolasi antrean per user dan pastikan akun berbeda tidak dapat membaca/mengirim item lama.
- Tentukan kebijakan logout yang tidak membuang kunjungan belum terkirim tanpa sepengetahuan pengguna: tawarkan sinkronisasi atau jelaskan/pastikan penghapusan, lalu bersihkan file dan metadata sesuai pilihan.
- Tinjau enkripsi at-rest untuk data antrean/draft dan foto. SecureStore cocok untuk rahasia kecil seperti token, bukan pengganti penyimpanan terenkripsi untuk queue besar. Hindari menambah dependency atau mengubah versi tanpa kebutuhan yang dibuktikan.
- Pilih kebijakan backup Android: nonaktifkan backup aplikasi atau keluarkan data sensitif secara selektif untuk cloud backup dan device transfer; pertahankan pengecualian SecureStore yang diperlukan. Verifikasi konfigurasi hasil build.
- Tetapkan masa retensi dan pembersihan file foto/draft yang sudah sukses atau kedaluwarsa.

**Verifikasi**
- Uji logout saat antrean kosong/berisi, ganti akun, restart, sinkronisasi sukses/gagal, backup/restore policy, dan penghapusan file.

### Fase 5 — WebView peta dan pihak ketiga

**File utama**
- `gps-tracker-mobile/src/components/maps/OpenStreetMapView.js` (HTML/Leaflet sekitar baris 38 dan 78; WebView/bridge sekitar baris 301–305)
- `gps-tracker-mobile/src/config/maps.js`
- Pemanggil peta: `gps-tracker-mobile/src/screens/MyLocationScreen.js`, `gps-tracker-mobile/src/screens/StartVisitScreen.js`, `gps-tracker-mobile/src/screens/spv/LiveMapScreen.js`, `gps-tracker-mobile/src/screens/spv/SalesDetailScreen.js`

**Perubahan yang direncanakan**
- Hilangkan ketergantungan runtime pada Leaflet JS/CSS dari unpkg dengan membundel versi yang sudah dipin, atau terapkan integritas sumber jika strategi bundling tidak sesuai.
- Validasi skema pesan WebView, jenis event, koordinat finite dan dalam rentang, serta ID marker yang dikenal sebelum data dipakai.
- Jangan memasukkan data pribadi/token ke HTML/bridge peta. Validasi nilai marker yang disisipkan ke HTML.
- Tinjau navigasi eksternal, origin, mixed content, dan kebutuhan `originWhitelist=['*']`; jangan sekadar mempersempit whitelist sambil tetap memakai HTML inline tanpa mengubah strategi pemuatan.
- Dokumentasikan bahwa penyedia tile pihak ketiga menerima permintaan tile yang dapat mengungkap IP dan area geografis; pastikan attribution dan kebijakan penggunaan provider dipenuhi.

**Verifikasi**
- Uji payload bridge malformed, koordinat invalid, navigasi tak diizinkan, offline, dan tampilan peta pada Android.

### Fase 6 — Otorisasi dan penyimpanan foto kunjungan

**File utama**
- `gps-tracker/config/filesystems.php` (sekitar baris 77–97: disk foto dan default visibility)
- `gps-tracker/app/Services/Visits/VisitPhotoUrlService.php`
- `gps-tracker/app/Http/Controllers/Api/VisitPhotoController.php`
- `gps-tracker/app/Models/VisitPhoto.php`
- `gps-tracker/routes/api.php`

**Perubahan yang direncanakan**
- Verifikasi konfigurasi produksi aktual, object storage, web server, symlink, dan bucket policy. Jangan menganggap temporary URL cukup bila objek dasarnya tetap bisa diakses publik.
- Pastikan objek foto privat secara default dan hanya bisa diakses melalui otorisasi pengguna/role yang tepat atau signed URL berumur pendek.
- Pastikan endpoint unduh/preview tidak menerima path arbitrer dan membatasi akses berdasarkan resource yang memang boleh dilihat user.

**Verifikasi**
- Uji akses tanpa autentikasi, user lain, URL kedaluwarsa, ID/path yang dimanipulasi, dan akses sah.

### Fase 7 — Permission, dependency, dan kesiapan rilis

**File utama**
- `gps-tracker-mobile/app.json` (permission Android; `RECORD_AUDIO` tercantum dua kali)
- `gps-tracker-mobile/package.json` dan `package-lock.json`
- Konfigurasi EAS/build mobile untuk meninjau hasil manifest/AAB; jangan mengubah URL staging pada task ini.
- `gps-tracker/composer.json` dan `composer.lock`
- Store listing/Data Safety/privacy policy (lokasi dokumentasi/konfigurasi ditentukan oleh tim rilis)

**Perubahan yang direncanakan**
- Pastikan permission mikrofon benar-benar dibutuhkan; bila tidak ada perekaman audio, keluarkan dari manifest final melalui konfigurasi Expo yang tepat.
- Audit permission dan disclosure terhadap fitur aktual serta manifest hasil build, bukan hanya app.json.
- Jalankan `npm audit` dan `composer audit` pada CI/lingkungan dengan akses registry. Perbaiki hanya advisories yang terverifikasi dan relevan, tanpa bump versi secara massal.
- Cocokkan Data Safety dan privacy policy dengan data yang dikirim backend, lokasi background, foto, crash/diagnostic logs, peta/tile, serta SDK pihak ketiga.

**Verifikasi**
- Periksa merged manifest dan metadata AAB; review permission deklaratif dan uji alur instalasi/update.
- Simpan hasil dependency scan beserta severity, versi rentan, exploitability, dan keputusan mitigasi.

## Cakupan file ringkas

| Area | File inti |
| --- | --- |
| Logging | `gps-tracker-mobile/src/utils/diagnosticLogger.js`, `src/utils/offlineQueue.js`, `src/utils/offlineSyncTask.js`, serta callsite screen/hook yang tercantum di Fase 1 |
| Auth/location | `gps-tracker-mobile/src/context/AuthContext.js`, `src/utils/backgroundTracker.js`, `src/api/client.js`, `app.json` |
| Backend token | `gps-tracker/config/sanctum.php`, `gps-tracker/app/Http/Controllers/Api/AuthController.php`, route auth API |
| Penyimpanan lokal | `gps-tracker-mobile/src/utils/offlineQueue.js`, `src/context/AuthContext.js`, `app.json`; KYC screen hanya jika aktif |
| WebView/maps | `gps-tracker-mobile/src/components/maps/OpenStreetMapView.js`, `src/config/maps.js`, pemanggil peta |
| Foto server | `gps-tracker/config/filesystems.php`, `gps-tracker/app/Services/Visits/VisitPhotoUrlService.php`, `gps-tracker/app/Http/Controllers/Api/VisitPhotoController.php`, route terkait |
| Release | `gps-tracker-mobile/app.json`, `package.json`, `package-lock.json`, EAS config; backend composer manifests |

## Fokus review sebelum implementasi

- Jangan membocorkan informasi rahasia lewat logging, error UI, atau diagnostic export.
- Jangan mengambil lokasi sebelum pengguna mendapat disclosure dan memberi persetujuan OS yang sesuai.
- Jangan mengaktifkan expiry token tanpa menangani kompatibilitas mobile dan perangkat yang sudah login.
- Jangan menghapus antrean offline yang belum terkirim secara diam-diam.
- Jangan menganggap path lokal/private URL menjamin objek foto privat; periksa konfigurasi dan akses deployment.
- Jangan menaikkan versi aplikasi atau dependency pada pekerjaan ini tanpa keputusan terpisah.
