# Area Manager Own Customers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tampilkan customer SAP milik AM sendiri bersama customer Sales cabangnya dan izinkan kode SAP AM di form user.

**Architecture:** Gunakan kolom `slpCode` yang sudah ada. Validasi dan simpan role `spv`; perluas cakupan katalog dan sinkronisasi terjadwal; kirim jenis pemilik ke mobile untuk label yang tepat.

**Tech Stack:** Laravel, PHPUnit, React Native Expo SDK 54, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-23-area-manager-own-customers-design.md`

## Global Constraints

- AM adalah role `spv`; kode SAP AM opsional, Sales wajib.
- Customer tetap dibatasi `team_id` dan `master_source=sap_outstanding_receivable`.
- Hak admin cabang untuk membuat user tidak meluas.
- Tidak ada migrasi atau dependency native.

## Review Focus

- AM tanpa `slpCode` tetap melihat Sales cabangnya.
- AM dengan kode tidak melihat toko berkode sama di cabang lain.
- Kode Sales nonaktif tidak ikut memberi cakupan AM.
- Sinkronisasi SAP AM tidak menonaktifkan customer milik Sales lain.
- Kartu customer milik AM tidak diberi label Sales.
- Katalog SAP AM yang kosong tidak memicu permintaan berulang selama cache masih segar.
- Edit akun lama dengan kode ganda historis tidak gagal bila kode dan cabangnya tidak berubah.
- Spasi di sekitar kode tidak menghindari pemeriksaan keunikan dan tidak tersimpan.

---

### Task 1: API user dan cakupan customer AM

**Files:** `gps-tracker/app/Http/Requests/UserRequest.php`, `app/Http/Controllers/Api/UserController.php`, `app/Services/MasterData/StoreCatalogSyncService.php`, `app/Http/Controllers/Api/StoreController.php`, feature tests.

- [ ] Tulis tes gagal untuk create/update AM `slpCode`, daftar/peta/visit customer AM, AM tanpa kode, dan batas cabang.
- [ ] Jalankan tes fokus; pastikan gagal karena perilaku lama.
- [ ] Implementasi penyimpanan kode dan gabungan kode pemilik AM + Sales cabang, termasuk label jenis pemilik.
- [ ] Jalankan tes fokus dan tes API yang terkait.

### Task 2: Sinkronisasi katalog kode AM

**Files:** `gps-tracker/app/Services/MasterData/StoreCatalogSyncService.php`, `routes/console.php`, feature tests.

- [ ] Tulis tes gagal untuk sinkronisasi AM dari SAP dan keamanan katalog Sales lain.
- [ ] Jalankan tes fokus; pastikan gagal karena katalog AM belum disinkronkan.
- [ ] Aktifkan sinkronisasi AM berkode saat katalog kosong/kedaluwarsa dan dalam scheduler.
- [ ] Jalankan tes fokus dan tes backend penuh.

### Task 3: Form dan label mobile

**Files:** `gps-tracker-mobile/src/screens/admin/UserFormScreen.js`, `src/screens/StartVisitScreen.js`, `src/components/visit/VisitStoreRow.js`, `src/utils/userSapCode.js`, Node tests.

- [ ] Tulis tes gagal untuk kode AM dalam payload dan label pemilik AM/Sales.
- [ ] Jalankan tes fokus; pastikan gagal karena helper belum ada.
- [ ] Tampilkan input kode SAP untuk AM, simpan saat role `spv`, teruskan jenis pemilik pada toko, dan tampilkan label tepat.
- [ ] Jalankan tes Node, ekspor bundle Android, dan pemeriksaan sintaks.

### Task 4: Dokumentasi dan verifikasi

**Files:** `docs/release/area-manager-visit-staging-handoff.md`, `docs/README.md`.

- [ ] Perbarui cara rilis backend lebih dulu dan OTA dua runtime, serta cara menambah kode AM.
- [ ] Jalankan tes backend penuh, tes mobile, dan `git diff --check`.
- [ ] Commit perubahan lokal dan laporkan status deployment secara tepat.
