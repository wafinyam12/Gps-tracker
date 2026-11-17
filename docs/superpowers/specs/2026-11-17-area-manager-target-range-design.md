# Area Manager target harian untuk rentang tanggal

**Tanggal:** 17 November 2026  
**Status:** Disetujui pengguna pada 17 November 2026

## Kebutuhan

Area Manager (role `spv`) dapat mengatur angka target kunjungan untuk satu Sales atau beberapa Sales, atau semua Sales aktif di cabang/timnya. Pengaturan berlaku untuk satu tanggal atau rentang tanggal inklusif. Area Manager tidak dapat melihat atau mengubah target Sales cabang lain. Sesudah disimpan, ringkasan dan dashboard Sales memakai angka yang baru.

## Kondisi saat ini

Backend sudah memiliki tabel `daily_targets` dengan kunci unik `(user_id, target_date)`, `POST /target/set` untuk satu Sales dan satu tanggal, serta fallback 5 kunjungan pada tanggal yang belum diatur. Mobile sudah membaca angka target dari API, tetapi belum menyediakan form pengaturan. `POST /target/bulk-set` saat ini hanya menerima satu tanggal dan tidak tersedia untuk Area Manager.

## Pendekatan

1. **Satu endpoint rentang tanggal dalam transaksi — dipilih pengguna.** Server memeriksa cabang dan role semua Sales, membuat pasangan Sales × tanggal, lalu menyimpannya atomik. Mobile mengirim satu permintaan dan menampilkan jumlah penerima serta hari sebelum konfirmasi.
2. Banyak permintaan harian dari mobile. Memakai API lama, tetapi jaringan terputus dapat menyisakan sebagian target tersimpan.
3. Mengubah kontrak `bulk-set` lama. Lebih sedikit endpoint, tetapi mengubah perilaku yang sudah dipakai admin.

## Backend

- Tambahkan `GET /api/v1/target/eligible-sales` untuk `spv`. Data minimum: ID dan nama Sales aktif dari `team_id` milik akun. Jika AM tidak memiliki cabang, balas 403. Jangan menerima `team_id` dari klien.
- Tambahkan `POST /api/v1/target/range-set` untuk `spv` dengan `{selection: "all" | "selected", user_ids?: number[], date_from: "YYYY-MM-DD", date_to: "YYYY-MM-DD", target_visits: number}`. `selected` memerlukan 1–100 ID unik; `all` mengabaikan ID klien dan memilih semua Sales aktif dari cabang AM di server.
- Batasi rentang ke 31 hari kalender inklusif dan angka target ke 1–100. Validasi seluruh ID sebagai Sales aktif dalam cabang AM sebelum menulis satu baris pun. Penerima kosong ditolak dengan 422. Akses lintas cabang atau role selain Sales ditolak dengan 403 tanpa perubahan data.
- Simpan seluruh pasangan melalui upsert per batch dalam satu transaksi DB. Gunakan kunci unik yang sudah ada, isi `set_by`, dan kembalikan `sales_count`, `days_count`, `targets_written`. Menyimpan ulang pilihan yang sama bersifat idempoten; target lama pada tanggal yang dipilih akan ditimpa setelah konfirmasi mobile.
- Perketat endpoint pengaturan target lama agar hanya menerima target user ber-role Sales. Pertahankan bentuk respons dan batas role lainnya. Tambahkan tes otorisasi lintas cabang, role non-Sales, validasi rentang, transaksi tanpa hasil parsial, dan upsert.
- Fallback 5 untuk tanggal yang belum diatur tetap berlaku selama pilot supaya laporan lama tidak berubah tiba-tiba. Hal ini harus terlihat jelas di form; perubahan target default global memerlukan keputusan terpisah.

## Mobile

- Dari `Ringkasan kunjungan` Area Manager, tampilkan `Atur target harian`; role lain tidak mendapat aksi ini. Layar baru memakai palet kunjungan SDK 54 dan menampilkan nama cabang tetap.
- Pilihan `Semua Sales aktif` atau `Pilih Sales`, dengan daftar Sales aktif dari endpoint terscope. Tanggal mulai dan selesai memakai date picker Android; tanggal sama berarti satu hari. Angka 1–100 diisi melalui keyboard numerik.
- Sebelum kirim, tampilkan konfirmasi: jumlah Sales × jumlah hari, rentang, angka target, dan bahwa target yang sudah ada pada rentang ini akan diganti. Kegagalan validasi/API tampil di form tanpa kehilangan pilihan. Saat berhasil, kembali ke ringkasan dan muat ulang target.
- Tidak menyimpan target secara offline; ini operasi administrasi yang memerlukan respons server. Tidak ada dependency native, izin, atau perubahan runtime. Deploy backend harus mendahului OTA mobile.

## Verifikasi dan rilis

Jalankan tes backend terkait `DailyTarget` dan API, tes presentasi mobile, suite offline, Android export, lalu uji di Infinix lewat ADB memakai akun AM dan Sales dummy. Pastikan daftar hanya berisi Sales cabang AM, tanggal inklusif, overwrite sesuai konfirmasi, ringkasan berubah, dan tidak ada opsi cabang global. Terbitkan OTA hanya ke staging runtime 1.1.5; tidak perlu build APK baru bila kode native tetap sama.
