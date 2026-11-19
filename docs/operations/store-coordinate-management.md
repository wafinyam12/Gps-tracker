# Koordinat Master Toko di CRM

## Kapan dipakai

Gunakan menu **Master Toko** di CRM untuk memeriksa atau memperbaiki titik toko dan radius kunjungan. Data foto visit dapat membantu memilih titik, terutama jika sales lupa checkout atau checkout jauh dari toko. Koordinat checkout tidak otomatis mengganti titik toko.

## Pemeriksaan dan koreksi manual

1. Cari toko dengan nama, kode toko, atau kode BP. Filter cabang dan status titik bila diperlukan.
2. Buka detail toko. Periksa titik master, peta, check-in terbaru, foto visit, akurasi GPS foto, dan riwayat koreksi.
3. Jika foto relevan, pilih **Gunakan titik foto**. Tombol itu mengisi formulir; periksa lokasi dan isi foto sebelum menyimpan. Foto lama dapat dipakai sebagai referensi manual, tetapi akurasi GPS-nya tidak diketahui.
4. Admin cabang dapat menyimpan toko cabangnya; superadmin dapat menyimpan seluruh cabang. Masukkan titik latitude/longitude, radius 1–50 meter, dan alasan koreksi. Manager dan SPV hanya dapat melihat.
5. Setelah simpan, periksa riwayat yang mencatat nilai sebelumnya, nilai baru, aktor, alasan, dan foto sumber jika dipilih.

Koreksi tidak mengubah laporan checkout yang sudah selesai. Kunjungan terbuka yang belum punya pusat geofence akan memakai titik baru untuk checkout berikutnya. Titik yang sudah menjadi snapshot kunjungan tetap. Koreksi lokal juga tidak otomatis dikirim ke SAP.

## Foto baru dari aplikasi

Aplikasi mengukur GPS baru untuk setiap foto setelah tombol kamera ditekan. Setiap foto membawa waktu, titik, akurasi, dan tanda mock jika tersedia, termasuk saat upload masuk antrean offline. Foto tetap dapat disimpan jika GPS gagal atau izin lokasi ditolak; foto tersebut tidak memenuhi syarat pengisian master otomatis.

Jika master toko kosong, server hanya mengambil titik dari foto baru yang memenuhi aturan kualitas: akurasi maksimal 25 meter, bukan mock, waktu GPS dekat dengan waktu foto, visit valid, dan titik foto dekat check-in. Foto lama yang sudah ada sebelum fitur ini tetap perlu pemeriksaan manual. Titik master yang sudah diatur tidak ditimpa oleh foto berikutnya.

## Data CRM yang berubah dari mobile

Dashboard dan halaman Master Toko memeriksa perubahan database setiap 20 detik selama tab browser terlihat. Jika visit, foto, lokasi sales, atau data master berubah, konten halaman diperbarui tanpa menekan refresh. Tab analisis, detail visit yang terbuka, dan posisi scroll dipertahankan. Penyegaran berhenti sementara jika ada perubahan formulir yang belum diterapkan agar input tidak hilang; terapkan filter atau simpan koreksi untuk memuat data terbaru. Saat koneksi gagal, halaman mencoba lagi otomatis.

Jika data belum muncul segera, pastikan mobile sudah berhasil mengirimnya ke server atau antrean offline telah tersinkron. Browser yang tab-nya tersembunyi memeriksa ulang saat dibuka. Sebagai cadangan untuk perubahan dengan waktu database yang sama, halaman mengambil ulang konten paling lambat sekitar dua menit sekali.

## Rilis

Rilis backend beserta migrasi database terlebih dahulu, kemudian terbitkan bundle mobile ke runtime OTA `1.1.5` dan `1.1.6` jika API kamera/lokasi yang dipakai tersedia pada kedua APK. Ikuti [panduan build dan OTA staging](../release/build-staging.md) untuk perintah dan pemeriksaan runtime. API tetap menerima antrean foto lama tanpa metadata per foto; foto lama tersebut tidak mengisi master otomatis.
