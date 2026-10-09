# Dokumen UAT — Sales Daily Mobile

**Status:** Siap untuk pelaksanaan UAT setelah APK internal terbaru tersedia  
**Lingkungan:** Hostinger UAT — `crm-sales.utomo-dev.xyz`  
**Versi aplikasi sumber:** `1.1.0` (`android.versionCode` terakhir tercatat `3`)  
**Tanggal persiapan:** 7 Oktober 2026

## 1. Tujuan

Memastikan perubahan keamanan aplikasi Sales Daily Mobile dan backend berfungsi pada lingkungan UAT sebelum build dipakai lebih luas. Dokumen ini mencatat prasyarat, skenario, hasil aktual, bukti, dan keputusan UAT.

## 2. Cakupan perubahan

- Login, masa berlaku token, refresh token, dan rotasi token setelah perubahan kata sandi.
- Disclosure serta persetujuan pelacakan lokasi, termasuk saat aplikasi berjalan di latar belakang.
- Sanitasi log diagnostik agar token, payload, dan data sensitif tidak ikut tercatat.
- Antrean sinkronisasi offline, pemisahan cache/draf berdasarkan akun, serta penanganan logout ketika antrean masih tertunda.
- Upload dan preview foto kunjungan pada penyimpanan privat.
- Kebijakan privasi dan tautannya di aplikasi.
- Izin Android, termasuk pemblokiran `RECORD_AUDIO` dan penonaktifan backup.
- Peta/WebView dan pembatasan navigasi serta sumber daya eksternal.

## 3. Prasyarat sebelum UAT

Lengkapi dan tandai setiap butir sebelum pengujian aplikasi:

- [ ] Build EAS Android baru berstatus berhasil dan APK internal dapat diunduh.
- [ ] Profil build pada `eas.json` adalah profil internal (umumnya `preview` dengan `distribution: internal`).
- [ ] API URL yang dibundel di aplikasi menunjuk ke `https://crm-sales.utomo-dev.xyz`; `APP_URL` backend saja tidak mengatur URL API pada aplikasi.
- [ ] APK dipasang pada perangkat Android uji dan dapat dibuka.
- [ ] Jika memasang sebagai pembaruan di atas aplikasi yang sama, `versionCode` dinaikkan dari `3` menjadi `4`, kecuali EAS mengelola kenaikannya secara otomatis.
- [ ] Akun uji tersedia untuk peran yang akan diuji (Sales dan, bila relevan, SPV/Admin). Jangan gunakan akun produksi.
- [ ] Data toko, target, dan kunjungan uji disiapkan; tentukan data mana yang boleh dibuat atau dihapus.
- [ ] Database, email, storage foto, dan integrasi lain yang dipakai adalah milik UAT dan tidak memengaruhi produksi.
- [ ] Akses untuk melihat `storage/logs/laravel.log` tersedia bagi petugas UAT.

Command build dari PowerShell:

```powershell
cd "D:\gps tracker\gps-tracker-mobile"
npx eas-cli@latest build --platform android --profile preview
```

Ganti `preview` jika nama profil internal di `eas.json` berbeda. Internal distribution Android seharusnya menghasilkan APK yang dapat dipasang langsung.

## 4. Pemeriksaan backend yang sudah teramati

Pemeriksaan SSH yang dikirim pada 7 Oktober 2026 menunjukkan:

- `php artisan about` berhasil dijalankan; Laravel `11.54.0`, PHP `8.4.24`, dan Debug Mode `OFF`.
- Environment yang dilaporkan saat pemeriksaan adalah `production`; URL aplikasi adalah `crm-sales.utomo-dev.xyz`. Pastikan koneksi database, mail, storage, dan integrasi tetap menunjuk ke layanan/data UAT.
- `php artisan route:list` berhasil dan menampilkan 63 route, termasuk `/up`, `/privacy-policy`, serta endpoint autentikasi, kunjungan, lokasi, dan foto.
- `php artisan migrate:status` menunjukkan seluruh migrasi berstatus `Ran`, termasuk `2026_10_01_000001_add_client_uuid_to_visit_photos_table`.

> Pemeriksaan CLI membuktikan aplikasi dapat boot, route dapat didaftarkan, dan migrasi tercatat selesai. Ini belum membuktikan request HTTP, autentikasi, database saat runtime, upload foto, atau alur aplikasi telah lulus UAT.

## 5. Cara mencatat hasil

Untuk setiap kasus, isi kolom **Aktual**, **Status**, **Bukti**, serta nama tester dan tanggal. Gunakan status `Lulus`, `Gagal`, atau `Tidak diuji`. Jika gagal, catat langkah reproduksi dan ID bug.

| ID | Kasus dan langkah uji | Hasil yang diharapkan | Aktual / bukti | Status |
|---|---|---|---|---|
| UAT-01 | Buka `https://crm-sales.utomo-dev.xyz/up` dan `/privacy-policy`. | Kedua halaman merespons normal; health check `/up` memberi HTTP 200 dan kebijakan privasi tampil. |  | Belum diuji |
| UAT-02 | Pasang APK baru, buka aplikasi, dan login dengan akun uji yang valid. | APK dapat dipasang/dibuka; login berhasil; data yang tampil berasal dari lingkungan UAT. |  | Belum diuji |
| UAT-03 | Coba login dengan kata sandi salah. | Login ditolak dengan pesan yang wajar; aplikasi tidak menampilkan stack trace atau detail rahasia. |  | Belum diuji |
| UAT-04 | Buka halaman yang meminta lokasi sebelum memberi izin OS. | Disclosure tujuan dan penggunaan lokasi muncul terlebih dahulu; izin OS baru diminta setelah tindakan pengguna. |  | Belum diuji |
| UAT-05 | Tolak izin lokasi atau persetujuan pelacakan, lalu buka alur non-lokasi. | Aplikasi menghormati penolakan; alur yang tidak membutuhkan lokasi tetap dapat digunakan. |  | Belum diuji |
| UAT-06 | Beri persetujuan dan izin lokasi; jalankan alur tracking sesuai kebijakan UAT, lalu pindahkan aplikasi ke background. | Lokasi hanya dikirim setelah persetujuan dan izin; status tracking sesuai pilihan pengguna dan kebijakan aplikasi. |  | Belum diuji |
| UAT-07 | Mulai kunjungan, lakukan check-in/check-out sesuai peran, dan sinkronkan. | Kunjungan tersimpan sekali dengan data/waktu/lokasi yang sesuai; tidak ada duplikasi. |  | Belum diuji |
| UAT-08 | Upload foto kunjungan, buka preview, lalu akses URL preview setelah masa berlaku berakhir bila dapat diuji. | Pengguna berwenang dapat melihat foto; akses tanpa autentikasi/URL kedaluwarsa ditolak. |  | Belum diuji |
| UAT-09 | Buat item antrean saat offline, pulihkan koneksi, dan sinkronkan. | Item tersinkron satu kali; kegagalan sementara tidak menghilangkan data antrean. |  | Belum diuji |
| UAT-10 | Logout saat antrean offline masih tertunda. | Aplikasi menawarkan sinkronisasi atau konfirmasi penghapusan; antrean akun tidak bocor ke akun lain. |  | Belum diuji |
| UAT-11 | Login dengan akun A, simpan draf KYC/cache; logout lalu login dengan akun B. | Draf dan cache akun A tidak terlihat oleh akun B. |  | Belum diuji |
| UAT-12 | Ubah kata sandi akun uji; uji sesi pada perangkat saat ini dan perangkat/sesi lain. | Token perangkat saat ini dirotasi; sesi lain dicabut sesuai implementasi. Login ulang menggunakan kata sandi baru berhasil. |  | Belum diuji |
| UAT-13 | Lakukan alur refresh token menggunakan akun/sesi uji yang sesuai. | Token yang masih dapat diperbarui diperbarui tanpa meminta login; sesi kedaluwarsa ditangani dengan aman. Catat `Tidak diuji` jika tidak tersedia sesi yang memenuhi kondisi refresh. |  | Belum diuji |
| UAT-14 | Lakukan beberapa alur gagal yang aman, kemudian telaah log aplikasi/backend. | Log tidak memuat token, kata sandi, payload formulir, URL foto bertanda tangan, atau konfigurasi request sensitif. |  | Belum diuji |
| UAT-15 | Buka peta, marker, dan petunjuk arah; coba navigasi keluar dari tujuan yang diizinkan jika relevan. | Peta berfungsi; WebView menolak navigasi/sumber daya yang tidak diizinkan; tidak ada crash. |  | Belum diuji |
| UAT-16 | Periksa permission hasil build (merged manifest atau App Bundle Explorer). | `RECORD_AUDIO` tidak ada; permission lokasi/kamera yang diperlukan tetap ada; backup Android dinonaktifkan. |  | Belum diuji |

## 6. Ringkasan eksekusi

| Informasi | Isi |
|---|---|
| Build ID / tautan EAS |  |
| Versi aplikasi / versionCode |  |
| Perangkat dan versi Android |  |
| Tester dan tanggal |  |
| Kasus lulus / gagal / tidak diuji |  |
| Bug terbuka (ID dan prioritas) |  |
| Keputusan | Belum diputuskan |

## 7. Kriteria keputusan

UAT dapat dinyatakan **Lulus** bila semua alur kritis (login, consent/izin lokasi sesuai kebutuhan, kunjungan, upload/preview foto, sinkronisasi offline, dan pemisahan data akun) lulus, tidak ada bug penghambat, dan tidak ditemukan data sensitif dalam log. Semua kasus `Gagal` atau `Tidak diuji` harus memiliki tindak lanjut dan persetujuan pemilik UAT sebelum rilis berikutnya.

## 8. Catatan insiden dan bug

| ID | Langkah reproduksi | Hasil aktual | Hasil yang diharapkan | Severity | Bukti/lokasi log | Status |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |
