# Customer SAP milik Area Manager

## Tujuan

Area Manager (role `spv`) dapat mempunyai kode Sales SAP sendiri dan customer yang terdaftar pada kode itu. Daftar toko kunjungan AM perlu menampilkan customer miliknya bersama customer Sales aktif dalam cabang yang sama, tanpa membuka customer cabang lain atau mengubah pemilik SAP.

## Pendekatan

- **Dipilih:** pakai kolom `users.slpCode` yang sudah ada. Form user menampilkan kode untuk Sales (wajib) dan AM (opsional). Backend menyimpan kode AM, menjadwalkan sinkronisasi SAP untuk kode tersebut, dan memperluas cakupan daftar AM menjadi gabungan kode AM sendiri serta Sales aktif di cabangnya.
- Menambah kolom atau menduplikasi customer ke akun Sales akan membuat dua sumber kebenaran; tidak diperlukan karena `stores.sap_slp_code` dan relasi cabang sudah ada.

## Perilaku

1. Superadmin dapat membuat/mengubah AM dengan kode Sales SAP; admin cabang tetap hanya dapat mengelola Sales. AM tanpa kode tetap melihat customer Sales aktif di cabangnya seperti sebelumnya.
2. Kode Sales wajib untuk role Sales, opsional untuk AM, dan tidak dikirim untuk role lain. Kode yang diberikan unik di cabang yang sama; kode sama di database SAP cabang lain boleh dipakai. Mengubah role Sales ↔ AM mempertahankan isian kode pada form.
3. Saat AM berkode login atau scheduler berjalan, katalog SAP untuk kode AM disinkronkan dengan aturan yang sama seperti Sales. API daftar toko, pencarian, peta, dan mulai visit memakai cakupan yang sama. Kode AM tidak otomatis memberi akses ke customer cabang lain.
4. Kartu toko menunjukkan `Area Manager: <nama>` untuk customer kode AM dan `Sales: <nama>` untuk customer Sales. Visit tetap dicatat atas akun AM dan tidak masuk target harian Sales.
5. Jika AM dan Sales berbagi kode dalam cabang yang sama secara historis, daftar tidak menduplikasi toko dan label pemilik mengikuti akun AM untuk kode AM itu. Validasi user baru mencegah pemakaian kode ganda di cabang yang sama.

## Pemeriksaan

Tes API mencakup pembuatan/perubahan kode AM, AM tanpa kode, daftar dan mulai visit dengan customer AM, batas cabang, serta sinkronisasi katalog AM. Tes mobile mencakup payload kode berdasarkan role dan label pemilik. Tidak perlu migrasi database atau modul native baru.
