# User Acceptance Test (UAT) — Sales Daily Mobile

| Informasi | Nilai |
|---|---|
| Produk | Sales Daily / GPS Tracker Mobile |
| Platform uji | Android APK staging (portrait) |
| Versi acuan | 1.1.0 — Android `versionCode` 3 |
| API staging | `https://crm-sales.utomo-dev.xyz/api/v1` |
| Tanggal pelaksanaan | ____________________ |
| UAT lead | ____________________ |
| Build / tautan APK | ____________________ |
| Hasil akhir | ☐ Diterima &nbsp; ☐ Diterima bersyarat &nbsp; ☐ Ditolak |

Dokumen ini dibuat dari fitur yang tersedia pada aplikasi mobile saat ini. Kolom **Status**, **Hasil aktual**, dan **Bukti** diisi oleh pelaksana UAT; status yang dipakai: `PASS`, `FAIL`, `BLOCKED`, atau `N/A`.

## 1. Tujuan dan kriteria penerimaan

Memastikan sales dapat mencatat kunjungan yang dapat diaudit (GPS, foto, hasil visit), data tetap aman ketika jaringan putus, serta supervisor/administrator dapat memantau aktivitas sesuai kewenangannya.

UAT diterima bila:

- Seluruh skenario prioritas P0 dan P1 berstatus `PASS`.
- Tidak ada defect terbuka dengan tingkat Critical atau High.
- Data test dapat dilihat konsisten pada dashboard/monitoring sesuai role dan cabang.
- Bukti untuk tiap kasus (screenshot, ID visit, atau rekaman layar) terlampir.

## 2. Prasyarat dan data uji

Sebelum mulai, siapkan kondisi berikut.

| Kode | Data / kondisi yang diperlukan |
|---|---|
| D-01 | APK staging terpasang pada Android fisik, internet aktif, GPS mode akurasi tinggi, serta tanggal/jam perangkat benar (WIB). |
| D-02 | Akun aktif: `Sales A`, `SPV A`, `Manager`, `Admin Cabang`, dan `Super Admin`; serta satu akun nonaktif. Masing-masing memiliki password awal yang diketahui tester. |
| D-03 | Sales A dan SPV A berada pada cabang yang sama; siapkan minimal satu cabang lain untuk menguji pembatasan akses cabang. |
| D-04 | Toko aktif berkoordinat dengan titik uji di dalam radius; titik di luar radius sekitar lebih dari 50 m; satu toko aktif tanpa koordinat; dan satu toko yang sudah dikunjungi Sales A hari ini. |
| D-05 | Satu perangkat/area dengan sinyal stabil dan satu kondisi offline (airplane mode atau Wi-Fi/data dimatikan). Jangan menghapus data aplikasi selama skenario offline belum selesai. |
| D-06 | Izin lokasi foreground, lokasi background, kamera, dan galeri dapat diubah dari Settings perangkat untuk menguji penolakan izin. Jangan memakai aplikasi Fake GPS di perangkat produksi; gunakan perangkat uji khusus untuk TC-GPS-05. |
| D-07 | Siapkan nominal cash payment, nama PIC/customer, nomor WhatsApp, dan foto bukti pembayaran yang valid. |

Catatan: radius geofence efektif aplikasi dibatasi maksimum **50 meter**. Lokasi check-in harus tersedia, bukan mock/fake GPS, usia titik tidak lebih dari 5 menit, dan akurasinya tidak lebih dari 300 m.

## 3. Matriks akses role

| Fitur | Sales | SPV | Manager | Admin Cabang | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Kunjungan pribadi, GPS background | ✓ | ✓ | — | — | — |
| Monitoring peta dan ringkasan | — | ✓ (cabang sendiri) | ✓ | ✓ (cabang sendiri) | ✓ (semua cabang) |
| Kelola user | — | — | — | ✓ | ✓ |
| Kelola cabang | — | — | — | ✓* | ✓ |
| Kelola/lihat master toko | — | — | — | — | ✓ (daftar toko) |
| Profil dan logout | ✓ | ✓ | ✓ | ✓ | ✓ |

`*` Pembuatan, pengaktifan/nonaktif, dan penghapusan cabang hanya untuk Super Admin. Semua pembatasan perlu diuji juga dengan mencoba URL/aksi yang tidak berhak; sistem harus menolak tanpa mengubah data.

## 4. Daftar kasus uji

### A. Instalasi, login, dan session

| ID | Pri. | Role | Langkah uji | Hasil yang diharapkan | Status | Hasil aktual / bukti |
|---|:---:|---|---|---|:---:|---|
| TC-AUTH-01 | P0 | Semua | Instal APK staging, buka aplikasi pertama kali. | Aplikasi terbuka tanpa crash, menampilkan halaman Login, dan tidak meminta izin yang tidak relevan sebelum login. | ☐ | |
| TC-AUTH-02 | P0 | Sales | Login memakai username valid dan password valid. | Pesan login berhasil tampil; pengguna masuk ke Beranda Sales; ringkasan hari ini tampil; tracking GPS mencoba aktif setelah izin diberikan. | ☐ | |
| TC-AUTH-03 | P1 | Semua | Login dengan email terdaftar dan password valid. | Login berhasil; email diterima sebagai identifier. | ☐ | |
| TC-AUTH-04 | P0 | Semua | Login dengan password salah. | Login ditolak, pesan kredensial salah jelas, tidak ada session/akses aplikasi. | ☐ | |
| TC-AUTH-05 | P1 | Semua | Login menggunakan akun nonaktif. | Login ditolak dengan informasi akun tidak aktif; akun tidak dapat mengakses data. | ☐ | |
| TC-AUTH-06 | P1 | Semua | Lakukan percobaan login salah berulang hingga rate limit, lalu perhatikan tombol Login. | Aplikasi menampilkan pesan pembatasan percobaan dan countdown; tombol terkunci sampai waktu tunggu selesai. | ☐ | |
| TC-AUTH-07 | P0 | Semua | Login, tutup paksa aplikasi, lalu buka kembali ketika internet tersedia. | Session aktif dipulihkan dengan aman dan pengguna masuk ke layar sesuai role tanpa login ulang. | ☐ | |
| TC-AUTH-08 | P0 | Semua | Dari Profil atau dashboard, pilih Logout lalu buka kembali aplikasi. | Session dan token perangkat dihapus; aplikasi kembali ke Login; halaman terlindungi tidak dapat dibuka. | ☐ | |
| TC-AUTH-09 | P0 | Semua | Login masing-masing akun D-02. | Menu yang muncul sesuai matriks akses; Sales/SPV dapat visit, Manager tidak mendapat menu visit, dan menu administrasi hanya muncul pada role yang berhak. | ☐ | |

### B. Izin dan validitas GPS

| ID | Pri. | Role | Langkah uji | Hasil yang diharapkan | Status | Hasil aktual / bukti |
|---|:---:|---|---|---|:---:|---|
| TC-GPS-01 | P0 | Sales | Saat aplikasi meminta izin lokasi foreground dan background, pilih Izinkan; kembali ke Beranda. | Status GPS aktif tampil setelah lokasi didapat; notifikasi foreground service tampil sesuai OS; lokasi dapat dipakai untuk visit. | ☐ | |
| TC-GPS-02 | P0 | Sales | Tolak izin lokasi, lalu pilih Mulai Visit atau Lokasi Saya. | Aplikasi tidak crash; tampil alasan bahwa izin lokasi diperlukan; visit tidak dapat dimulai sampai izin diberikan. | ☐ | |
| TC-GPS-03 | P1 | Sales | Buka Lokasi Saya dengan izin GPS aktif, bergerak beberapa meter atau refresh lokasi. | Marker posisi, koordinat, dan akurasi diperbarui; tombol pusatkan peta bekerja; marker toko yang memiliki koordinat terlihat. | ☐ | |
| TC-GPS-04 | P0 | Sales | Pada lokasi dengan akurasi buruk (>300 m) atau titik GPS yang sudah stale, coba mulai/check-out visit. | Proses ditolak dengan pesan GPS belum presisi atau lokasi terlalu lama; visit tidak tercatat sebagai data valid. | ☐ | |
| TC-GPS-05 | P0 | Sales | Di perangkat uji yang mendeteksi mock location, aktifkan Fake GPS dan coba mulai/check-out visit. | Proses ditolak dengan pesan Fake GPS terdeteksi; tidak ada visit valid yang tersimpan. | ☐ | |
| TC-GPS-06 | P1 | Sales | Setelah GPS dan background location diizinkan, minimalkan aplikasi selama minimal satu interval tracking atau berpindah ±50 m. Buka monitoring dengan akun SPV. | Ping lokasi terbaru Sales terlihat pada monitoring (waktu, posisi, status online); tidak ada crash atau konsumsi tracking yang menghentikan aplikasi. | ☐ | |

### C. Kunjungan Sales

| ID | Pri. | Role | Langkah uji | Hasil yang diharapkan | Status | Hasil aktual / bukti |
|---|:---:|---|---|---|:---:|---|
| TC-VISIT-01 | P0 | Sales | Dari Beranda pilih Mulai Visit. Cari toko D-04 berdasarkan kode, nama, alamat, dan cabang; scroll hingga memuat halaman berikutnya. | Daftar toko aktif sesuai cakupan sales tampil; pencarian relevan; pagination tidak menampilkan duplikasi; toko bisa dipilih di peta/list. | ☐ | |
| TC-VISIT-02 | P1 | Sales | Pilih toko berkoordinat dan tekan Rute. | Google Maps/aplikasi peta terbuka ke koordinat toko. Jika toko tidak berkoordinat, aplikasi menampilkan “Rute Belum Tersedia” tanpa crash. | ☐ | |
| TC-VISIT-03 | P0 | Sales | Berada dalam radius toko D-04, pilih Mulai. | Check-in berhasil dan form visit terbuka; status lokasi valid, jarak/radius bila tersedia, dan ID visit tercatat sebagai bukti. | ☐ | |
| TC-VISIT-04 | P0 | Sales | Berada di luar radius toko berkoordinat (lebih dari 50 m), pilih Mulai. | Visit dapat diberi warning lokasi di luar radius namun **tidak dihitung ke target**; jarak/check-in validitas dapat diaudit pada detail/ringkasan. | ☐ | |
| TC-VISIT-05 | P1 | Sales | Mulai visit pada toko tanpa koordinat dengan GPS akurat, lalu selesaikan checkout. | Visit tersimpan; setelah checkout valid, titik check-in dapat menjadi observasi koordinat toko sesuai aturan server (akurasi check-in ≤25 m). | ☐ | |
| TC-VISIT-06 | P0 | Sales | Saat satu visit masih terbuka, coba Mulai pada toko lain. | Sistem menolak dengan informasi kunjungan aktif dan opsi membuka visit aktif; tidak terbentuk dua visit terbuka. | ☐ | |
| TC-VISIT-07 | P1 | Sales | Selesaikan satu visit pada toko yang sama, kemudian mulai lagi di toko sama pada hari yang sama. | Visit kedua ditandai duplicate dan tidak dihitung ke target; warning duplicate terlihat. | ☐ | |
| TC-VISIT-08 | P0 | Sales | Pada form visit, isi PIC, pilih satu Aktivitas Kunjungan, satu Hasil Visit, respon customer (opsional), dan Catatan; simpan/check-out. | Hasil visit wajib dipilih; checkout berhasil; durasi, hasil, catatan, dan metadata submit tersimpan dan dapat dibuka kembali sebagai detail read-only. | ☐ | |
| TC-VISIT-09 | P0 | Sales | Coba checkout tanpa izin/posisi GPS yang valid. | Checkout ditolak dengan pesan yang dapat ditindaklanjuti; visit tetap terbuka dan data form tidak hilang. | ☐ | |
| TC-VISIT-10 | P1 | Sales | Pada form visit pilih Batalkan & Kembali ke List Toko, konfirmasi pembatalan. | Visit yang belum selesai terhapus/dibatalkan setelah konfirmasi; tidak ada visit terbuka tersisa. | ☐ | |
| TC-VISIT-11 | P1 | Sales | Buka Visit Terbaru atau Ringkasan, buka satu visit selesai dan satu visit aktif. | Data toko, waktu, hasil, status duplicate/target, foto, dan catatan sesuai data yang disimpan; visit selesai tidak dapat diedit sebagai visit aktif. | ☐ | |
| TC-VISIT-12 | P1 | Sales | Perbarui Beranda (pull-to-refresh) setelah visit valid dan duplicate. | Kartu target, toko unik, duplicate, progress, warning, dan daftar visit terbaru konsisten dengan data server. | ☐ | |

### D. Foto kunjungan dan cash payment

| ID | Pri. | Role | Langkah uji | Hasil yang diharapkan | Status | Hasil aktual / bukti |
|---|:---:|---|---|---|:---:|---|
| TC-PHOTO-01 | P0 | Sales | Di visit aktif pilih Foto Wajib, izinkan kamera, ambil foto, lihat preview, lalu unggah. | Foto terunggah dan jumlah/thumbnail foto bertambah pada form atau detail visit. | ☐ | |
| TC-PHOTO-02 | P1 | Sales | Ambil 6 foto pada satu proses upload. | Aplikasi membatasi maksimum 5 foto dan memberi informasi limit; tidak crash. | ☐ | |
| TC-PHOTO-03 | P1 | Sales | Tolak izin kamera, lalu pilih Foto Wajib. | Aplikasi menjelaskan izin kamera dibutuhkan dan tidak mengunggah foto kosong. | ☐ | |
| TC-PHOTO-04 | P1 | Sales | Dari galeri foto visit, buka thumbnail lalu hapus satu foto dan konfirmasi. | Preview foto dapat dibuka; foto hanya hilang setelah konfirmasi dan jumlah foto terbarui. | ☐ | |
| TC-CASH-01 | P0 | Sales | Pada visit server yang aktif, isi nominal, nama customer/PIC, WhatsApp, ambil foto bukti, lalu Kirim Cash Payment. | Semua isian wajib tervalidasi; cash payment sukses terkirim beserta foto dan titik GPS valid. Simpan ID transaksi/bukti. | ☐ | |
| TC-CASH-02 | P1 | Sales | Uji cash payment dengan salah satu field wajib kosong, tanpa foto, serta GPS invalid. | Pengiriman ditolak secara jelas per kondisi dan tidak membuat transaksi parsial/duplikat. | ☐ | |
| TC-CASH-03 | P1 | Sales | Buat visit dalam mode offline lalu coba kirim cash payment. | Aplikasi memberi tahu cash payment hanya bisa dikirim setelah visit offline tersinkron; tidak kehilangan input secara tidak terduga. | ☐ | |

### E. Offline dan sinkronisasi

| ID | Pri. | Role | Langkah uji | Hasil yang diharapkan | Status | Hasil aktual / bukti |
|---|:---:|---|---|---|:---:|---|
| TC-OFF-01 | P0 | Sales | Saat online, buka Mulai Visit sekali agar daftar toko tersimpan. Aktifkan airplane mode, buka Mulai Visit lagi. | Daftar customer cache tetap dapat digunakan dan aplikasi memberi penanda mode offline. | ☐ | |
| TC-OFF-02 | P0 | Sales | Dalam kondisi offline, check-in pada toko cache dengan GPS valid, isi form, ambil foto, dan checkout. | Check-in, foto, dan checkout disimpan aman pada perangkat; notifikasi menjelaskan data akan disinkronkan; urutan data tidak berubah. | ☐ | |
| TC-OFF-03 | P0 | Sales | Setelah TC-OFF-02, pulihkan internet dan buka aplikasi/aktifkan aplikasi; bila tersedia tekan Sinkronkan Sekarang. | Antrian mengirim check-in → foto/checkout sesuai dependensi; notifikasi sukses muncul; visit hanya tercipta sekali dan data/foto lengkap di server. | ☐ | |
| TC-OFF-04 | P1 | Sales | Putuskan jaringan saat upload foto atau checkout visit online, lalu pulihkan jaringan. | Data gagal kirim masuk antrian offline; setelah sinkron, data terkirim satu kali tanpa data hilang/duplikat. | ☐ | |
| TC-OFF-05 | P1 | Sales | Saat masih offline dengan antrian visit, pilih Batalkan. | Data visit offline beserta item antrian terkait dihapus dari perangkat setelah konfirmasi dan tidak terkirim ketika internet pulih. | ☐ | |

### F. Monitoring, laporan, dan peringatan

| ID | Pri. | Role | Langkah uji | Hasil yang diharapkan | Status | Hasil aktual / bukti |
|---|:---:|---|---|---|:---:|---|
| TC-MON-01 | P0 | SPV / Admin / Manager / Super Admin | Buka Monitoring Kunjungan setelah Sales A mengirim ping. Tekan refresh dan tunggu interval pembaruan. | Marker sales dan cabang tampil; status online/offline serta waktu terakhir sesuai data ping; refresh manual dan otomatis (±60 detik) berfungsi. | ☐ | |
| TC-MON-02 | P0 | SPV / Admin | Pada akun cabang A, coba lihat data cabang B lewat marker/filter/detail bila tersedia. | Data sales/cabang di luar kewenangan tidak tampil atau ditolak; data cabang sendiri tetap terlihat. | ☐ | |
| TC-MON-03 | P1 | Super Admin | Dari peta global pilih marker cabang, kembali ke semua cabang, aktifkan/nonaktifkan layer customer, dan zoom peta. | Cabang dapat difokuskan; kembali global berhasil; customer tampil sebagai marker/cluster sesuai zoom dan tidak menghambat peta. | ☐ | |
| TC-MON-04 | P1 | SPV / Manager / Admin / Super Admin | Tekan marker sales untuk membuka Detail Sales. | Detail menampilkan posisi terakhir, riwayat/ringkasan yang diizinkan, dan data sesuai sales yang dipilih; akses lintas cabang tetap dibatasi. | ☐ | |
| TC-REP-01 | P0 | SPV / Manager / Admin / Super Admin | Buka Ringkasan & Warning, pilih tanggal/cabang yang diizinkan, buka detail salah satu sales. | Target, kunjungan valid, duplicate, invalid check-in, progress, dan warning konsisten dengan visit yang dibuat; navigasi ke detail sales berfungsi. | ☐ | |
| TC-REP-02 | P1 | SPV / Manager / Admin / Super Admin | Buat kondisi target belum tercapai atau invalid/duplicate, lalu buka daftar warning. | Warning yang relevan tampil dan mengarahkan ke sales terkait; tidak ada warning milik cabang yang tidak berhak. | ☐ | |

### G. Administrasi dan profil

| ID | Pri. | Role | Langkah uji | Hasil yang diharapkan | Status | Hasil aktual / bukti |
|---|:---:|---|---|---|:---:|---|
| TC-ADM-01 | P0 | Admin / Super Admin | Buka Manajemen User; cari user, filter role, filter status, lalu reset filter. | Daftar dan jumlah user sesuai scope; pencarian/filter/reset menghasilkan data yang benar. | ☐ | |
| TC-ADM-02 | P0 | Admin / Super Admin | Buat user Sales dengan isian valid: nama, username, email, password, cabang, dan kode sales SAP. Login memakai akun baru. | User tersimpan dan dapat login; validasi mewajibkan cabang serta kode Sales SAP untuk role Sales. | ☐ | |
| TC-ADM-03 | P1 | Admin / Super Admin | Ubah user, nonaktifkan user lain, verifikasi user itu tidak dapat login; aktifkan kembali. Coba nonaktifkan akun sendiri. | Perubahan tersimpan; akun nonaktif ditolak saat login; akun sendiri tidak dapat dinonaktifkan dari layar ini. | ☐ | |
| TC-ADM-04 | P1 | Super Admin | Buat cabang dengan nama, kode, DB SAP, koordinat, dan kredensial UD Portal; uji validasi field kosong serta ambil lokasi saat ini. | Cabang baru tersimpan; validasi wajib tampil; koordinat dapat diambil dengan izin lokasi. | ☐ | |
| TC-ADM-05 | P1 | Admin / Super Admin | Buka Manajemen Cabang dan uji edit/aksi aktif-hapus sesuai role. | Admin hanya mendapat aksi yang diizinkan; Super Admin dapat mengelola lifecycle cabang setelah konfirmasi; perubahan tidak merusak scope data. | ☐ | |
| TC-ADM-06 | P1 | Super Admin | Buka Manajemen Toko dan cari/pilih toko. | Daftar toko master tampil sesuai data SAP; tidak ada perubahan data toko yang tidak didukung oleh UI/role saat ini. | ☐ | |
| TC-PRO-01 | P1 | Semua | Buka Profil, ubah nama/username/email/no. HP, simpan, lalu restart aplikasi. | Profil dan header/nama pengguna diperbarui serta tetap konsisten setelah aplikasi dibuka ulang. | ☐ | |
| TC-PRO-02 | P1 | Semua | Ubah foto profil melalui galeri: sekali izinkan dan sekali tolak izin galeri. | Foto berhasil diperbarui pada kondisi diizinkan; penolakan izin memberi pesan yang jelas tanpa crash. | ☐ | |
| TC-PRO-03 | P0 | Semua | Ubah password: uji password lama salah, baru <8 karakter, konfirmasi berbeda, lalu data valid. Logout dan login dengan password baru. | Setiap validasi ditampilkan dengan benar; hanya password valid yang tersimpan dan dapat dipakai login. | ☐ | |

## 5. Rekap eksekusi

| Prioritas | Total | PASS | FAIL | BLOCKED | N/A |
|---|---:|---:|---:|---:|---:|
| P0 |  |  |  |  |  |
| P1 |  |  |  |  |  |
| **Total** |  |  |  |  |  |

## 6. Log defect

| Defect ID | TC terkait | Ringkasan | Severity | Langkah reproduksi / bukti | Pemilik | Status |
|---|---|---|---|---|---|---|
| DEF-001 |  |  | ☐ Critical ☐ High ☐ Medium ☐ Low |  |  | Open |
| DEF-002 |  |  | ☐ Critical ☐ High ☐ Medium ☐ Low |  |  | Open |
| DEF-003 |  |  | ☐ Critical ☐ High ☐ Medium ☐ Low |  |  | Open |

Panduan severity: **Critical** = layanan/data audit tidak dapat digunakan atau data rusak; **High** = fungsi bisnis utama gagal tanpa workaround; **Medium** = ada workaround namun proses terganggu; **Low** = kosmetik atau gangguan minor.

## 7. Persetujuan

| Peran | Nama | Keputusan / catatan | Tanggal | Tanda tangan |
|---|---|---|---|---|
| Perwakilan Sales |  |  |  |  |
| Perwakilan SPV / Operasional |  |  |  |  |
| Product Owner |  |  |  |  |
| QA / UAT Lead |  |  |  |  |
