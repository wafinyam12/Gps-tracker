# Rancangan pengelolaan koordinat master toko

Status: usulan untuk ditinjau, belum diimplementasikan.

## Tujuan

Koordinat foto kunjungan dapat membantu mengisi titik master toko yang kosong. Admin juga perlu dapat memeriksa bukti dan memperbaiki titik master secara manual di CRM, terutama ketika check-in kurang akurat atau sales checkout jauh dari toko. Kunjungan #66 adalah contoh: master toko kosong, check-in berakurasi 34,1 m, dan dua foto menampilkan titik yang sama sekitar 2,46 m dari check-in.

## Keadaan sekarang dan batasan

- Aplikasi mengambil satu koordinat sebelum membuka kamera, lalu mengirimnya untuk semua foto dalam sesi. Server menulis koordinat itu ke metadata EXIF foto. Dua foto dengan geotag sama belum merupakan dua pengukuran GPS yang independen.
- `visit_photos` belum menyimpan akurasi, waktu pengukuran GPS, atau tanda mock GPS. Foto lama tidak memenuhi syarat untuk penetapan master otomatis, walaupun dapat diperiksa manusia.
- Koordinat master yang kosong saat kunjungan selesai saat ini dapat diisi dari check-in bila akurasinya maksimal 25 m. Pusat geofence kunjungan disimpan sebagai snapshot saat check-in; mengubah master toko saja belum memperbaiki perhitungan checkout untuk kunjungan yang sudah terbuka.
- Menu Toko CRM saat ini hanya berisi analisis toko yang dikunjungi pada periode filter. Belum ada pencarian seluruh master toko atau perubahan koordinat.
- Sinkronisasi katalog SAP mempertahankan koordinat lokal yang sudah ada. Sinkronisasi koordinat *ke* SAP saat ini terutama untuk rekonsiliasi awal dari observasi check-in; perubahan manual tidak otomatis membuat tugas sinkronisasi baru.

## Pendekatan

1. **Manual saja.** Admin memilih titik foto atau mengetik koordinat di CRM. Paling sederhana dan memadai untuk foto lama, tetapi toko kosong lain tetap menunggu admin.
2. **GPS foto baru yang memenuhi syarat mengisi master kosong; admin dapat mengoreksi.** Foto lama menjadi kandidat manual. Ini usulan utama karena membantu toko baru tanpa menghilangkan kontrol koreksi.
3. **Semua foto menunggu persetujuan admin.** Mencegah pengisian otomatis yang keliru, tetapi menambah pekerjaan dan memperlambat tersedianya titik geofence.

Pendekatan 2 dipilih sebagai usulan berdasarkan permintaan geotag sebagai acuan dan tambahan pengaturan manual. Keputusan akhir menunggu tinjauan pengguna atas dokumen ini.

## Alur yang diusulkan

### Foto dan pengisian otomatis

1. Tombol kamera tetap dapat dipakai. Setiap kali sales memotret, aplikasi menyimpan waktu jepret dan meminta pengukuran GPS baru di sekitar waktu itu. Kegagalan memperoleh GPS tidak membuang foto atau mengosongkan form kunjungan.
2. Setiap foto membawa koordinat, akurasi, waktu pengukuran, dan tanda mock GPS sendiri melalui upload online maupun antrean offline. API tetap menerima payload lama dari aplikasi yang belum mendapat OTA; payload lama ditandai sebagai sumber lama dan tidak boleh mengisi master otomatis.
3. Server hanya menganggap titik foto layak untuk master bila lengkap, bukan mock, akurasi maksimal 25 m, waktu pengukuran paling jauh 60 detik dari waktu jepret, dan jaraknya dari check-in maksimal 100 m. Bila salah satu gagal, foto tetap disimpan sebagai bukti tetapi titiknya hanya kandidat untuk pemeriksaan manual.
4. Jika master toko masih kosong, server mengisi dari satu titik foto yang layak. Perubahan memakai transaksi dan penguncian baris toko agar upload foto dan checkout bersamaan tidak saling menimpa. Titik master yang sudah ada tidak diubah oleh foto.
5. Untuk kunjungan yang masih terbuka dan belum mempunyai pusat geofence, titik baru itu juga menjadi acuan checkout dengan sumber `photo`. Jika foto baru tersinkron setelah checkout, status checkout historis tidak dihitung ulang secara diam-diam.

### Pengaturan manual di CRM

1. Menu **Master Toko** terpisah dari analisis periode, dengan pencarian nama/kode/BP dan filter cabang serta status koordinat. Daftar dipaginasi sehingga seluruh katalog tetap dapat dicari.
2. Detail toko menampilkan titik master, radius geofence, peta, check-in terbaru, foto beserta titik dan kualitas GPS-nya, serta riwayat koreksi. Foto lama diberi keterangan **akurasi tidak tersedia**.
3. Admin dan superadmin dapat memilih **Gunakan titik foto** sebagai isian awal atau memasukkan lat/long manual, menyesuaikan radius dalam batas sistem 1–50 m, lalu menyimpan dengan alasan wajib. Manager dan SPV hanya melihat sesuai cakupan cabangnya.
4. Setiap simpan mencatat aktor, waktu, alasan, nilai lama dan baru, serta ID foto sumber jika ada. Sumber katalog (`master_source`) tetap menunjukkan asal data toko; sumber koordinat dicatat tersendiri.
5. Untuk kunjungan yang masih terbuka dan pusat geofence-nya kosong, penetapan master manual mengisi snapshot pusat geofence dengan sumber `crm_manual`. Snapshot kunjungan yang sudah mempunyai pusat dan seluruh kunjungan selesai tetap seperti semula. Nilai target/validitas check-in historis tidak dihitung ulang otomatis.
6. Koreksi manual mendapat prioritas atas pengisian otomatis berikutnya: foto dan check-in hanya boleh mengisi master yang kosong. Katalog SAP tetap mempertahankan titik lokal sebagaimana perilaku sekarang.

### Penyegaran data CRM otomatis

Dashboard dan halaman Master Toko memeriksa perubahan data secara berkala selama tab browser terlihat. Pemeriksaan ringan membaca versi data dari database; halaman mengambil ulang konten dari server hanya bila versi berubah, termasuk setelah mobile mengirim visit, foto, dan lokasi. Konten diperbarui tanpa navigasi ulang. Filter, tab analisis, kunjungan yang sedang dibuka, dan posisi baca dipertahankan. Form koreksi yang sedang diketik tidak diganti; penyegaran dilanjutkan setelah form disimpan atau ditinggalkan. Pilihan teknis awal adalah polling 20 detik agar tidak bergantung pada koneksi WebSocket dan tidak memuat seluruh dashboard pada setiap pemeriksaan.

## Cakupan dan batas

- Yang dapat disunting dalam tahap ini adalah koordinat master dan radius geofence. Identitas toko, kode BP, cabang, dan data SAP lain tetap berasal dari katalog.
- Foto #66 dapat dipilih admin sebagai titik awal manual setelah memeriksa foto dan peta. Dua foto tersebut tidak diperlakukan sebagai dua bukti GPS independen, dan akurasi fotonya tidak dapat dipulihkan dari data lama.
- Perubahan master langsung berlaku untuk kunjungan baru. Kunjungan terbuka tanpa pusat acuan mendapat pusat baru seperti di atas; kunjungan selesai tidak diubah.
- Penyelarasan ulang koordinat yang dikoreksi manual *ke* SAP tidak otomatis pada tahap ini. CRM harus menampilkan status sinkronisasi yang ada agar perbedaan tidak tersembunyi. Perlu keputusan produk tersendiri sebelum koreksi manual dikirim ke sistem eksternal.
- Server harus dirilis lebih dulu. Pembaruan aplikasi untuk pengukuran GPS per foto perlu diterbitkan pada kedua runtime OTA 1.1.5 dan 1.1.6; API tetap kompatibel dengan foto yang sudah terantre offline.

## Kriteria hasil

- Admin dapat menemukan toko walaupun belum ada visit pada periode dashboard, memilih titik dari foto atau mengetik koordinat, menyimpan alasan, dan melihat riwayat perubahan.
- Kunjungan seperti #66 yang masih terbuka memperoleh acuan checkout setelah titik master disetujui manual, tanpa mengubah data kunjungan selesai.
- Foto baru dengan GPS layak dapat mengisi master kosong; foto lama, GPS tanpa akurasi, mock, atau titik terlalu jauh tidak dapat mengubah master otomatis.
- Foto tetap tersimpan jika pengukuran GPS per foto gagal; antrean offline dan klien lama tetap dapat mengunggah foto.
- Perubahan manual tidak tertimpa sinkronisasi katalog atau pengisian otomatis berikutnya.
- Perubahan visit, foto, atau titik toko dari mobile muncul di CRM yang sedang terbuka tanpa refresh manual, sementara filter dan form yang belum disimpan tetap terjaga.

## Risiko dan mitigasi

- GPS dalam toko dapat meleset: ambang akurasi dan kedekatan dengan check-in membatasi pengisian otomatis; admin dapat mengoreksi dengan bukti foto.
- Koordinat aplikasi tetap berasal dari perangkat dan bukan bukti lokasi yang tidak dapat dipalsukan. Riwayat sumber, tanda mock, akurasi, dan pemeriksaan manusia membuat keputusan dapat diaudit.
- Penggantian titik master saat ada kunjungan aktif dapat mengubah hasil checkout berikutnya. Hanya kunjungan aktif tanpa pusat acuan yang menerima pusat baru; sumbernya dicatat.
- Polling CRM dapat menambah beban database. Pemeriksaan versi harus murah, berhenti saat tab tidak terlihat, dan mengambil halaman lengkap hanya ketika data berubah.
