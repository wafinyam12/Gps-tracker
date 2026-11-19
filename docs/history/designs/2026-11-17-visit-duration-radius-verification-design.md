# Durasi kunjungan dengan pemeriksaan radius awal dan akhir

**Tanggal:** 17 November 2026
**Status:** Disetujui pengguna pada 17 November 2026; belum ada perubahan kode untuk fitur ini.

## Tujuan dan keputusan pengguna

Area Manager ingin mengetahui lama sesi kunjungan Sales di customer. Untuk pilot, angka utamanya adalah selisih waktu check-in sampai checkout, dengan syarat check-in dimulai di area customer. Jika checkout dilakukan di luar radius, visit tetap boleh selesai; AM melihat penanda, jarak, dan titik checkout. Customer yang belum memiliki koordinat tetap memakai titik check-in pertama yang memenuhi syarat sebagai calon lokasi customer, lalu checkout dibandingkan terhadap titik tersebut.

Angka ini diberi nama **durasi kunjungan**. Dua sampel lokasi pada awal dan akhir tidak membuktikan Sales berada di sana terus-menerus. Sistem tidak akan menyebutnya “waktu pasti di dalam radius”. Pengukuran waktu kumulatif di radius melalui sampel berkala adalah tahap terpisah jika kelak diperlukan.

## Kondisi kode saat ini

- `visit_logs` sudah menyimpan `checkin_at`, `checkout_at`, kedua titik GPS, dan `duration_minutes` yang dihitung dari selisih waktu. API visit dan CRM web sudah menampilkan durasi/average durasi. CRM web juga sudah menyediakan tautan peta untuk titik checkout; rilis ini menambah status radius, jarak, dan akurasi di dekat tautan itu.
- Radius customer maksimum 50 meter diperiksa pada check-in. Check-in di luar radius masih dapat tercatat dengan peringatan dan tidak dihitung ke target. Checkout menyimpan koordinat, tetapi belum menghitung jarak atau status radius.
- Jika customer belum punya koordinat, titik check-in baru disimpan ke master customer setelah visit selesai, hanya bila check-in bukan mock/duplikat dan akurasi titik awal tidak lebih dari 25 meter. Koordinat checkout tidak menjadi titik master.
- Mobile SDK 54 memiliki alur check-in/checkout offline terenkripsi. Ping latar belakang sekitar 5 menit/50 meter belum cukup untuk menyimpulkan keberadaan kontinu dalam radius 50 meter.

## Pendekatan yang dipertimbangkan

1. **Dipilih: durasi sesi dan pemeriksaan dua titik.** Memakai data waktu yang sudah ada, menegakkan radius saat mulai, mengklasifikasi lokasi checkout, dan memperlihatkan hasil ke Sales/AM. Cepat untuk pilot dan mempertahankan offline.
2. Hanya menampilkan selisih waktu saat ini. Tidak memenuhi syarat check-in harus di lokasi customer dan tidak mengungkap checkout di luar radius.
3. Menghitung waktu kumulatif dari GPS berkala. Lebih dekat dengan waktu fisik di customer, tetapi sampel 5 menit/50 meter saat ini terlalu jarang; perlu desain sampling, konsumsi baterai, jeda sinyal, offline, dan privasi yang lebih besar.

## Aturan kunjungan

### Customer dengan koordinat yang sudah ada

1. Mobile mengambil GPS baru sebelum check-in. Server menjadi sumber keputusan akhir, memakai titik customer dan radius efektif yang dibatasi maksimum 50 meter. Untuk keputusan dalam/luar radius, akurasi GPS harus tidak lebih buruk daripada radius efektif; jika lebih buruk atau tidak tersedia, minta ambil ulang titik dan jangan menyebutnya di dalam/di luar. Titik mock atau terlalu lama tetap mengikuti pemeriksaan integritas yang sudah ada.
2. Check-in online yang terukur di luar radius ditolak **sebelum** visit dibuat. Mobile menampilkan jarak, radius, dan aksi ambil ulang GPS/buka rute. Tidak ada “mulai visit” yang diam-diam dianggap sah di luar area.
3. Titik pusat dan radius saat check-in disimpan sebagai snapshot pada visit. Checkout dibandingkan ke snapshot itu sehingga perubahan koordinat master setelah check-in tidak mengubah hasil historis.
4. Checkout dalam radius: simpan durasi dan status `awal_dalam_radius`, `akhir_dalam_radius`.
5. Checkout di luar radius dengan GPS cukup akurat: visit tetap selesai, durasi tetap disimpan, tetapi statusnya `checkout_di_luar_radius`. Bila akurasi GPS lebih buruk daripada radius atau tidak tersedia, statusnya `checkout_belum_terverifikasi`, bukan tuduhan keluar area. AM melihat koordinat checkout, akurasi, jarak, radius, dan peta. Angka durasi tidak dipakai sebagai bukti keberadaan kontinu.
6. Flag `counted_as_target` yang sudah ditetapkan saat check-in tidak diubah oleh status checkout pada rilis ini. Penanda checkout dipakai untuk audit, agar KPI lama tidak berubah tanpa keputusan bisnis terpisah.

### Customer tanpa koordinat

1. Titik check-in berkualitas sesuai aturan awal yang sudah ada (akurasi maksimal 25 meter, bukan mock/duplikat) menjadi pusat sementara untuk visit tersebut. Mobile menjelaskan bahwa ini adalah **titik awal customer**, belum titik master yang terverifikasi mandiri.
2. Checkout dibandingkan dengan pusat sementara menggunakan radius maksimum 50 meter. Visit tetap dapat diselesaikan jika checkout di luar radius, dengan penanda dan titik checkout untuk AM.
3. Setelah visit selesai, titik master customer disimpan dari check-in sesuai alur yang sudah ada. Titik checkout tidak menggantikan check-in. Jika titik awal tidak memenuhi syarat kualitas, visit dapat tercatat sebagai `lokasi_awal_belum_terverifikasi`, tetapi tidak boleh diklaim sebagai durasi dengan dua titik dalam radius dan tidak mengisi master customer. Perhitungan target kunjungan untuk kasus ini tetap mengikuti aturan pilot saat ini sampai ada keputusan KPI terpisah.

### Offline, data lama, dan waktu

- Mobile memeriksa titik customer dari cache sebelum mengantre check-in offline dan menyertakan snapshot titik/radius cache sebagai konteks audit. Server menghitung ulang saat sinkronisasi dan tidak mempercayai titik yang dikirim perangkat sebagai master. Jika koordinat master berubah antara saat capture dan saat sinkron, atau versi lama tidak membawa snapshot dan titik sekarang berada di luar radius, visit tetap tersimpan untuk tinjauan dengan status awal belum terverifikasi dan tidak dihitung sebagai target; antrean tidak dihapus diam-diam. Waktu dan titik GPS capture tetap disimpan, serta aturan integritas anti-mock yang ada tetap berlaku.
- Checkout offline mengikuti urutan antrean check-in → checkout yang sudah ada; UUID replay tetap idempoten. Jika checkout berada di luar radius, status audit tersimpan tanpa memblokir sinkronisasi.
- Waktu negatif/terbalik atau GPS tanpa waktu yang dapat dipercaya tidak diberi label durasi terverifikasi. Visit lama tetap menampilkan durasi historisnya, dengan status radius checkout `belum_diverifikasi`; sistem tidak menyimpulkan status baru memakai koordinat master yang mungkin telah berubah.

## Data dan API

Tambahkan migration **aditif** pada `visit_logs` untuk snapshot pusat/radius check-in, akurasi dan jarak checkout, serta status pemeriksaan awal/akhir. `duration_minutes` dan bentuk field lama tetap ada. Status bernama eksplisit, misalnya `inside_radius`, `outside_radius`, `initial_reference`, `uncertain`, `legacy_unverified`; hindari label “terbukti berada sepanjang visit”.

Respons checkout dan detail visit menambahkan status awal/akhir, jarak/radius, durasi, koordinat checkout, dan penanda sumber titik customer. Endpoint AM tetap dibatasi ke cabangnya; koordinat checkout hanya dikirim pada detail visit yang memang boleh diakses, bukan daftar publik atau log diagnostik. API lama tetap dapat membaca field yang sudah ada.

## Tampilan

**Sales:** Sebelum check-in, kartu customer menunjukkan jarak/radius atau “titik customer belum tersedia”. Check-in di luar radius tidak dapat dimulai dan ada tombol ambil ulang lokasi. Setelah checkout, tampilkan durasi dan status lokasi akhir dengan kalimat jelas.

**AM mobile dan CRM web:** Detail visit menampilkan, misalnya (tautan peta checkout di CRM web sudah ada dan dipertahankan):

```text
Durasi kunjungan       17 menit (09.00–09.17)
Check-in               Dalam radius · 12 m dari customer
Checkout               Di luar radius · 132 m dari customer
Titik checkout         Lihat di peta
```

Jika customer berawal tanpa koordinat, tampilkan “Titik customer berasal dari check-in pertama”. Jika koordinat checkout tidak layak, tampilkan “Lokasi checkout belum terverifikasi”, bukan “di luar radius” tanpa bukti.

## Pengujian dan rilis

- Tes backend: dikenal/dalam, dikenal/luar saat mulai, checkout dalam/luar/akurasi lemah, customer tanpa titik, snapshot tidak berubah saat master berubah, waktu terbalik, mock GPS, akses AM lintas cabang, replay UUID, dan sync offline.
- Tes mobile: keputusan sebelum antre offline, pesan jarak/radius, status durasi, peta checkout, antrean tetap utuh saat gagal sync. Smoke test di Infinix untuk GPS dalam/luar radius dan keyboard/form checkout, memakai customer dummy; jangan mengubah visit Sales UAT nyata.
- Urutan rilis: migration aditif dan kode backend ke staging, verifikasi API, lalu OTA mobile SDK 54. Tidak direncanakan dependency atau izin native baru; bila implementasi tetap JS, tidak perlu APK baru. Jangan menerbitkan OTA sebelum backend staging siap.

## Di luar cakupan rilis ini

Menghitung menit yang benar-benar dihabiskan di dalam radius secara kontinu, mengubah `counted_as_target` akibat checkout di luar area, mengubah titik customer menggunakan koordinat checkout, dan koreksi otomatis koordinat customer yang salah.
