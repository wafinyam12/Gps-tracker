# Pelacakan waktu di area customer selama visit

**Tanggal:** 17 November 2026
**Status:** Implementasi lokal berjalan; deploy staging, OTA, dan uji perangkat masih menunggu verifikasi.

## Maksud

Area Manager ingin melihat berapa lama Sales diperkirakan berada dalam radius customer, bukan hanya selisih waktu check-in hingga checkout. Sales perlu tetap bisa bekerja saat layar HP terkunci atau jaringan putus. Pemakaian baterai perlu diukur pada perangkat Sales saat pilot, lalu frekuensi/akurasi disesuaikan jika terlalu boros. Setelah alur visit selesai, marker peta Sales dan Superadmin yang sekarang tidak tampil harus diperiksa dan diperbaiki berdasarkan penyebabnya.

## Keadaan sekarang

- Backend menyimpan check-in, checkout, dan durasi sesi. Belum ada sampel lokasi yang terikat ke visit untuk menghitung waktu di radius. Rancangan dua titik yang telah disetujui ada di `2026-11-17-visit-duration-radius-verification-design.md`; implementasinya belum dimulai.
- Radius bawaan customer adalah **50 m**; backend dan form membatasi nilainya ke **maksimal 50 m**. Nilai toko Sales 1 di staging belum dapat dibaca langsung karena ADB tidak tersedia di lingkungan kerja ini; perlu pemeriksaan kartu toko pada APK staging.
- Sinkronisasi katalog SAP menjaga koordinat master customer, tetapi mengisi `geofence_radius` dari data SAP/bawaan 50 m pada setiap pembaruan. Nilai radius yang dikalibrasi manual dapat tertimpa.
- Pelacakan global saat ini memakai akurasi `Balanced`, interval diminta 5 menit atau perpindahan 50 m, izin latar belakang, dan foreground service. Ping dikirim langsung ke API; kegagalan jaringan tidak menyimpan sampelnya untuk pengiriman ulang. Pelacakan foreground juga memiliki pengirim ping terpisah.
- Peta jalan masih terlihat pada HP menurut pengguna, tetapi semua marker hilang pada akun Sales dan Superadmin. Sumbernya belum dipastikan. Pada peta Sales, marker toko hanya dibentuk dari halaman daftar yang sedang dimuat (25 toko), bukan seluruh toko dalam viewport.

## Pendekatan

1. **Dipilih: sampel adaptif selama visit, ditambah pemeriksaan dua titik.** Check-in/checkout tetap menjadi awal/akhir sesi. Selama visit aktif, aplikasi meminta sampel GPS sekitar tiap 60 detik, termasuk jika Sales sementara keluar radius agar masuk kembali dapat terlihat. Setelah checkout, pelacakan global kembali ke sekitar 5 menit. Backend membagi durasi menjadi perkiraan dalam radius, di luar radius, dan tidak terukur. Data sampel ditahan terenkripsi bila offline.
2. Hanya check-in dan checkout. Lebih ringan untuk baterai, tetapi tidak mengetahui kapan Sales keluar dan masuk kembali di antara dua titik.
3. Geofence sistem Android saja. Hemat baterai, tetapi untuk radius customer 50 m dan pengukuran per menit kurang tepat: Android menganjurkan radius geofence 100–150 m dan peristiwa masuk/keluar bisa terlambat beberapa menit. Sumber: https://developer.android.com/develop/sensors-and-location/location/geofencing.

## Aturan lokasi dan waktu

1. Check-in customer dengan koordinat tetap harus memakai titik GPS baru di radius efektif toko, maksimal 50 m. Pusat/radius disimpan sebagai snapshot visit; perubahan master kemudian tidak mengubah penilaian historis. Customer tanpa koordinat memakai titik check-in berkualitas sebagai pusat sementara sesuai aturan yang sudah disetujui.
2. Saat visit aktif, satu pengirim lokasi untuk sampel visit meminta titik setiap sekitar 60 detik dengan akurasi tinggi; interval aktual bergantung Android. Beri notifikasi foreground service. Jangan menjalankan dua pengirim sampel visit yang menggandakan titik; ping global untuk monitoring tetap tersedia dengan frekuensi yang sesuai.
3. Tiap sampel membawa `visit_log_id`, UUID idempoten, titik, akurasi, waktu pengambilan, dan flag mock. Simpan dalam penyimpanan offline SQLCipher milik akun sebelum mencoba mengirim; kirim dalam batch saat online. Kegagalan jaringan tidak menghapus sampel. Backend memverifikasi pemilik visit, urutan waktu, batas waktu offline, anti-mock, dan tidak mempercayai status radius hasil perhitungan perangkat.
4. Backend mengklasifikasikan sampel terhadap snapshot pusat/radius: **dalam** hanya bila jarak dan akurasi cukup meyakinkan, **luar** hanya bila jarak setelah memperhitungkan ketidakpastian akurasi tetap melebihi radius, sisanya **tidak pasti**. Peralihan butuh dua sampel konsisten agar satu loncatan GPS tidak mengubah status. Jeda sampel panjang, izin hilang, perangkat mati, atau GPS buruk menjadi waktu **tidak terukur**.
5. Hitung tiga angka dalam detik yang jumlahnya sama dengan durasi sesi: `estimasi_dalam_radius`, `estimasi_di_luar_radius`, dan `tidak_terukur`. Tampilkan pembulatan menit yang konsisten. Jeda antara dua titik yang layak dihitung secara konservatif; sistem tidak mengisi jeda panjang dengan asumsi lokasi terakhir. Ini **estimasi**, bukan bukti posisi setiap detik atau posisi fisik di dalam bangunan.
6. Checkout boleh dilakukan di luar radius, dengan titik, akurasi, jarak, dan status yang dapat dilihat AM. Status checkout tidak mengubah keputusan `counted_as_target` saat check-in. Pelacakan visit berhenti sesudah checkout tersimpan/diantre offline; pelacakan global kembali ke sekitar 5 menit.
7. Jika izin latar belakang ditolak atau layanan berhenti, visit tetap bisa dikerjakan. Tampilkan pemberitahuan bahwa waktu di radius tidak dapat diukur penuh. Jangan menampilkan angka nol sebagai seolah Sales tidak berada di toko. Jika aplikasi dimatikan paksa, Android/Expo tidak menjamin tugas lokasi hidup kembali sampai aplikasi dibuka lagi.

## Radius customer

- Pertahankan bawaan 50 m untuk pilot; jangan mengecilkan semua customer secara massal. Titik master yang berasal dari check-in pertama adalah observasi awal dan dapat meleset dari pusat toko, terutama bila Sales berada di parkir/tepi jalan.
- Kalibrasi radius/titik per customer memakai beberapa observasi GPS yang akurasinya baik dan peninjauan AM, dengan catatan sumber serta waktu perubahan. **Superadmin tetap satu-satunya pihak yang mengubah master customer** sesuai izin sistem saat ini; AM meninjau hasil dan meminta koreksi melalui proses operasional. Jika titik master keliru, koreksi titik dahulu sebelum memperkecil radius. Nilai yang disetel manual harus bertahan melewati sinkronisasi SAP.
- Nilai radius aktual toko Sales 1 dan status koordinatnya di APK staging menjadi pemeriksaan awal sebelum uji nyata; jangan menyalin data identitas/titik pelanggan ke log atau percakapan.

## Tampilan dan akses

Laporan Sales/AM menampilkan, misalnya:

```text
Durasi kunjungan          45 menit (09.00–09.45)
Estimasi dalam radius     32 menit
Estimasi di luar radius    5 menit
Tidak terukur             8 menit
Checkout                  Di luar radius · lihat titik di peta
```

AM hanya melihat visit Sales di tim/cabang yang diizinkan; rincian titik hanya pada detail visit berizin. Visit lama tetap menampilkan durasi sesi dengan status pengukuran radius `belum tersedia`. Data sampel mentah tidak masuk log diagnostik atau daftar publik. **Usulan untuk pilot:** simpan sampel mentah di server 30 hari lalu hapus otomatis; ringkasan durasi tetap melekat pada visit. Jika kebijakan perusahaan mensyaratkan masa lain, gunakan kebijakan itu sebelum produksi.

## Pengukuran baterai dan layar terkunci

- Bandingkan konfigurasi saat ini (5 menit, `Balanced`) dengan konfigurasi visit aktif (sekitar 1 menit) pada **perangkat yang sama**, tanpa pengisian daya, dengan durasi, kondisi layar, jaringan, dan rute yang dicatat. Uji kondisi layar aktif dan layar terkunci; catat persentase baterai per jam, suhu/keluhan panas, jumlah sampel diterima, jeda lokasi, dan keberhasilan sinkronisasi. Android Battery Usage dan ADB `batterystats` dapat dipakai tanpa menambah paket native ke APK.
- Hasil pilot menentukan optimasi berikutnya: turunkan akurasi/frekuensi saat titik stabil, gunakan batch upload, atau perpanjang interval menjadi 2–3 menit bila kenaikan pemakaian baterai terlalu tinggi. Pengurangan frekuensi selalu disertai label ketidakpastian waktu yang lebih besar.
- Uji HP terkunci minimal selama satu sesi visit uji; pastikan notifikasi layanan tetap aktif dan sampel masuk/tersinkron. Jika perangkat/Android menghentikan tugas, jedanya tampil sebagai `tidak terukur`, bukan waktu dalam radius.

## Marker peta

Setelah pengukuran visit selesai, reproduksi marker hilang pada APK staging untuk Sales dan Superadmin. Periksa jumlah marker dari API, jumlah yang diterima React Native, kesiapan WebView, dan jumlah yang benar-benar digambar Leaflet. Perbaiki sumber yang terbukti rusak; peta Sales harus mengambil marker untuk viewport, bukan hanya 25 toko pada halaman daftar, bila itu penyebabnya. Uji marker, cluster, posisi Sales, dan titik checkout yang dapat dibuka AM; peta kosong harus menampilkan alasan yang jelas. Jangan mengubah peta berdasarkan dugaan sebelum bukti dari perangkat tersedia.

## Rilis dan batasan

- Kerjakan backend dan migrasi aditif dahulu, uji regresi, deploy ke staging, lalu OTA JS SDK 54 jika izin/dependency native pada APK yang terpasang sudah memadai. Verifikasi manifest APK sebelum mengklaim OTA cukup. Uji otomatis memakai database lokal terisolasi. Uji transaksi perangkat di staging menunggu akun Sales dan customer dummy yang diizinkan; akun Sales 1 nyata hanya untuk pemeriksaan baca-saja tanpa membuat visit uji.
- Rancangan ini memperluas rancangan dua titik dan menggantikan rencana implementasi lama setelah disetujui pengguna. Tidak ada pengukuran "exact" selama HP mati, GPS buruk, atau interval yang tidak disampel. Tidak ada klaim bahwa Sales berada di dalam bangunan berdasarkan GPS saja.
