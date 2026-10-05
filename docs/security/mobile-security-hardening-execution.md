# Eksekusi hardening keamanan mobile

Tanggal: 2026-10-05
Branch: `security/mobile-security-hardening-followup`
Rencana induk: `docs/superpowers/plans/2026-10-05-mobile-security-hardening.md`

## Perubahan yang sudah diterapkan

- Error mentah di log mobile diganti event diagnostik yang hanya menyimpan status, kode error, operasi, dan path yang disanitasi. Error response/payload dan Axios config tidak lagi diteruskan ke console atau diagnostic log.
- Tracking background tidak lagi dimulai otomatis tanpa disclosure. Aplikasi menjelaskan jenis data lokasi, tujuan, dan frekuensinya; pilihan disimpan per akun. Task background dan ping foreground berhenti bila consent tidak ada.
- Akses lokasi foreground pada layar visit, peta, form cabang/toko, dan KYC menampilkan disclosure penggunaan sebelum dialog permission OS.
- Sanctum token berlaku 30 hari. Client memperbarui token setelah 20 hari saat request berikutnya; perubahan password mencabut sesi perangkat lain dan merotasi token perangkat saat ini.
- Antrean offline hanya menyimpan header yang diizinkan, tidak menyimpan error server mentah, cache toko dipisahkan per user, dan logout dengan queue tertunda meminta sinkronisasi atau konfirmasi penghapusan.
- KYC draft dipisahkan per user. Backup Android dinonaktifkan dan permission `RECORD_AUDIO` diblokir; daftar permission duplikat dibersihkan.
- Leaflet CDN memakai Subresource Integrity. WebView membatasi navigasi, file access, mixed content, dan DOM storage; bridge memvalidasi skema, ID, warna, viewport, dan rentang koordinat.
- Disk foto lokal default diarahkan ke `storage/app/private/visit_photos` dengan visibility private.
- Halaman kebijakan privasi publik tersedia pada backend di `/privacy-policy`; aplikasi membuka tautan yang dibentuk dari host API aktif dari halaman Profil dan disclosure lokasi.

## Belum dapat dituntaskan dari repo saja

1. **Identitas dan kontak pengelola** belum diberikan. Lengkapi badan usaha/pengendali data dan kontak resmi pada halaman sebelum memakai tautannya di listing Play Store.
2. **Foto lama** adalah foto testing dan tidak perlu dimigrasikan. File/object lama tidak dihapus oleh perubahan source ini; bersihkan terpisah hanya jika diperlukan dan setelah target penyimpanannya dipastikan.
3. **Konfigurasi object storage pada deployment** tidak dapat dipastikan dari source. Verifikasi bucket policy, ACL, CDN/cache, preview URL TTL, dan hasil akses tanpa autentikasi pada lingkungan rilis.
4. **Enkripsi aplikasi untuk antrean AsyncStorage** belum ditambahkan. Data tetap berada di sandbox aplikasi Android dan backup Android dinonaktifkan. Belum ada primitive/dependency enkripsi yang sesuai di project; jangan menambahkan cipher buatan sendiri. Putuskan storage terenkripsi yang kompatibel dengan Expo/RN, lalu verifikasi di build perangkat.
5. **AAB/merged manifest, Data Safety, Permission Declaration, dan video demo background location** belum diverifikasi/disiapkan. Periksa pada proses build dan Play Console.
6. **Audit dependency** tidak dijalankan di branch ini. Jalankan npm/composer audit di CI dengan akses registry dan tangani advisory yang terbukti relevan.

## Verifikasi yang dilakukan

- `git diff --check` berhasil tanpa whitespace error.
- `gps-tracker-mobile/app.json` dapat diparse; versi tetap `1.1.0`, versionCode tetap `3`, dan `allowBackup` bernilai `false`.
- `php -l` bersih untuk `routes/web.php` dan halaman kebijakan privasi.
- Pencarian `console.error`/`console.log` di `gps-tracker-mobile/src` tidak menemukan callsite tersisa.
- Tidak ada test suite atau build yang dijalankan pada sesi ini.
