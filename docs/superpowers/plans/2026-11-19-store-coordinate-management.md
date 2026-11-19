# Store Coordinate Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin CRM dapat mengoreksi titik master toko dari foto atau input manual, sementara foto baru yang GPS-nya layak dapat mengisi master kosong dan menjadi acuan checkout kunjungan terbuka.

**Architecture:** Satu layanan backend mengatur perubahan koordinat, audit, dan pengisian pusat geofence yang masih kosong. CRM memakai route web tersendiri dengan daftar master toko yang dipaginasi. Upload foto menerima metadata GPS per foto tanpa memutus kompatibilitas payload lama; aplikasi mengukur GPS baru setelah tiap jepretan dan menyimpannya dalam antrean offline.

**Tech Stack:** Laravel 11, Blade, Eloquent Spatial, MySQL, React Native/Expo SDK 54, Node test runner, PHPUnit.

**Spec:** `docs/superpowers/specs/2026-11-19-store-coordinate-management-design.md`

## Global Constraints

- Hanya admin dan superadmin boleh mengubah koordinat dan radius; admin terbatas pada cabangnya. Manager dan SPV boleh melihat sesuai cakupan mereka.
- Radius geofence harus 1–50 m. Foto otomatis layak hanya bila akurasi GPS maksimal 25 m, waktu GPS dalam 60 detik dari jepretan, bukan mock, dan jarak dari check-in maksimal 100 m.
- Foto lama tanpa akurasi tetap dapat dipilih admin tetapi tidak boleh mengisi master otomatis. Foto tetap tersimpan bila GPS baru gagal.
- Titik yang sudah ada tidak ditimpa otomatis. Kunjungan selesai dan kunjungan terbuka dengan pusat geofence yang sudah ada tidak diubah.
- Sinkronisasi ulang koreksi manual ke SAP berada di luar cakupan. Backend dirilis sebelum OTA kedua runtime Android 1.1.5 dan 1.1.6.
- CRM memeriksa perubahan setiap 20 detik hanya saat tab terlihat; filter, tab, detail terbuka, posisi baca, dan form koreksi yang belum disimpan harus terjaga.

## Review Focus

- Store tanpa cabang dan admin cabang: admin tidak boleh melihat atau mengubahnya; superadmin boleh.
- ID foto milik toko lain: request koreksi ditolak dan tidak ada audit/perubahan.
- Foto offline tiba setelah checkout: master kosong boleh terisi dari foto layak, tetapi checkout selesai tidak berubah.
- Checkout bersamaan dengan koreksi manual: keputusan checkout memakai snapshot kunjungan terbaru dalam transaksi yang konsisten.
- Upload lama atau GPS foto gagal: foto tersimpan, tetapi master kosong tetap kosong.
- Data mobile berubah saat CRM dibuka: versi data berubah, konten baru muncul tanpa reload halaman; form yang sedang diketik tidak hilang.

---

### Task 1: Layanan koordinat dan audit

**Files:**
- Create: `gps-tracker/database/migrations/2026_11_19_000000_create_store_coordinate_changes_table.php`
- Create: `gps-tracker/app/Models/StoreCoordinateChange.php`
- Create: `gps-tracker/app/Services/Stores/StoreCoordinateService.php`
- Modify: `gps-tracker/app/Models/Store.php`
- Test: `gps-tracker/tests/Feature/StoreCoordinateManagementTest.php`

**Interfaces:**
- Produces: `StoreCoordinateService::setManual(Store $store, User $actor, Point $point, int $radius, string $reason, ?VisitPhoto $photo): StoreCoordinateChange`.
- Produces: `Store::coordinateChanges()` relation and nullable `stores.coordinate_source` (`crm_manual`, `photo`, or null).

- [ ] **Step 1: Write failing tests** for manual replacement with old/new audit, photo source linkage, active visit with null center updated, active visit with center preserved, and finished visit preserved.
- [ ] **Step 2: Run** `php artisan test --filter=StoreCoordinateManagementTest`; expect failure from missing model/service/schema.
- [ ] **Step 3: Create migration/model/service** with transactional store row lock; record actor, reason, source photo, old/new point and radius. For manual changes, update only open visits whose `geofence_center` is null.
- [ ] **Step 4: Run** the focused test; expect pass.
- [ ] **Step 5: Commit** service, migration, model, and test.

### Task 2: CRM master toko endpoints

**Files:**
- Create: `gps-tracker/app/Http/Controllers/Web/CrmStoreController.php`
- Create: `gps-tracker/resources/views/crm/stores/index.blade.php` (minimal route shell)
- Create: `gps-tracker/resources/views/crm/stores/show.blade.php` (minimal route shell)
- Modify: `gps-tracker/routes/web.php`
- Test: `gps-tracker/tests/Feature/CrmStoreManagementTest.php`

**Interfaces:**
- Consumes: `StoreCoordinateService::setManual(...)` from Task 1.
- Produces: named routes `crm.stores.index`, `crm.stores.show`, and `crm.stores.update` at `/crm/stores` and `/crm/stores/{store}`.

- [ ] **Step 1: Write failing feature tests** for searchable paginated stores regardless of dashboard period, branch visibility, admin/superadmin edit rights, manager/SPV read-only, invalid coordinates/radius/reason, and mismatched photo ID.
- [ ] **Step 2: Run** `php artisan test --filter=CrmStoreManagementTest`; expect route failures.
- [ ] **Step 3: Add controller and routes** with server-side scope checks; validate `latitude`, `longitude`, `geofence_radius` 1–50, `reason` 10–500 chars, optional `photo_id` belonging to store and having a location. Detail loads recent visits/photos, audit, and SAP sync status without unbounded queries.
- [ ] **Step 4: Run** focused test; expect pass.
- [ ] **Step 5: Commit** controller, routes, and test.

### Task 3: CRM interface

**Files:**
- Modify: `gps-tracker/resources/views/crm/stores/index.blade.php`
- Modify: `gps-tracker/resources/views/crm/stores/show.blade.php`
- Modify: `gps-tracker/resources/views/crm/dashboard.blade.php`
- Test: `gps-tracker/tests/Feature/CrmStoreManagementTest.php`

**Interfaces:**
- Consumes: routes and view data from Task 2.
- Produces: link **Master Toko**, list/search/filter, detail with current point/map link, recent photo candidates, correction form, and history.

- [ ] **Step 1: Add failing view assertions** for unvisited store in list, photo coordinate and legacy accuracy label, editable form only for editor role, audit history, and SAP status.
- [ ] **Step 2: Run** focused test; expect view failure.
- [ ] **Step 3: Build Blade pages** using CRM layout styles; photo button pre-fills lat/long but submits the actual values and photo ID, with CSRF and validation feedback. Add navigation from existing Toko tab.
- [ ] **Step 4: Run** focused test; expect pass.
- [ ] **Step 5: Commit** views and test.

### Task 4: Per-photo server metadata and automatic seed

**Files:**
- Create: `gps-tracker/database/migrations/2026_11_19_000001_add_visit_photo_location_evidence.php`
- Modify: `gps-tracker/app/Models/VisitPhoto.php`
- Modify: `gps-tracker/app/Http/Requests/VisitPhotoRequest.php`
- Modify: `gps-tracker/app/Http/Controllers/Api/VisitPhotoController.php`
- Test: `gps-tracker/tests/Feature/VisitPhotoCoordinateSeedTest.php`

**Interfaces:**
- Extends: `StoreCoordinateService` from Task 1 with `seedFromPhoto(VisitPhoto $photo): bool`; eligibility rules live here.
- Produces: optional `photo_metadata[index][latitude|longitude|accuracy|location_recorded_at|taken_at|is_mock_location]` fields aligned with `photos[]`; legacy top-level fields remain accepted but marked `legacy_shared`.

- [ ] **Step 1: Write failing API tests** for eligible photo seeding an empty master/open visit, legacy upload keeping master empty, bad/mismatched metadata rejected, offline photo after checkout preserving historic checkout, and idempotent UUID replay.
- [ ] **Step 2: Run** `php artisan test --filter=VisitPhotoCoordinateSeedTest`; expect failure.
- [ ] **Step 3: Add photo evidence columns and validation** and `seedFromPhoto(...)` eligibility to the coordinate service. Save each photo's own point/time/accuracy/mock/source, write its own EXIF, then call the coordinate service after record creation. Upload of a valid photo must succeed even when GPS evidence is missing or ineligible.
- [ ] **Step 4: Run** focused test; expect pass.
- [ ] **Step 5: Commit** migration, model, endpoint, and test.

### Task 5: Mobile capture and offline payload

**Files:**
- Create: `gps-tracker-mobile/src/utils/visitPhotoMetadata.js`
- Create: `gps-tracker-mobile/tests/visitPhotoMetadata.test.mjs`
- Modify: `gps-tracker-mobile/src/screens/CameraScreen.js`
- Modify: `gps-tracker-mobile/src/screens/VisitFormScreen.js`
- Modify: `gps-tracker-mobile/src/api/services/visitService.js`
- Modify: `gps-tracker-mobile/src/utils/offlineQueue.js`

**Interfaces:**
- Consumes: Task 4 multipart `photo_metadata[index]` contract.
- Produces: per-photo capture metadata stored beside each local image and serialized identically for online and offline upload.

- [ ] **Step 1: Read versioned Expo SDK 54 Camera and Location docs** as required by `gps-tracker-mobile/AGENTS.md`.
- [ ] **Step 2: Write failing Node tests** for per-photo metadata serialization, missing GPS, two distinct photo points, and offline retry preserving metadata.
- [ ] **Step 3: Run** `node --test tests/visitPhotoMetadata.test.mjs`; expect failure.
- [ ] **Step 4: Implement** fresh high-accuracy GPS sampling after each shutter without blocking the shutter or discarding captured image when sampling fails. Preserve per-photo metadata through photo save and offline queue; send indexed multipart fields to the API. Adjust disclosure text to mention photo.
- [ ] **Step 5: Run** focused tests, `npm run test:offline`, and `npm run check`; expect pass.
- [ ] **Step 6: Commit** mobile changes and test.

### Task 6: Checkout consistency, documentation, and final verification

**Files:**
- Modify: `gps-tracker/app/Http/Controllers/Api/CheckInController.php`
- Modify: `gps-tracker/tests/Feature/VisitRadiusVerificationTest.php`
- Modify: `docs/README.md`
- Modify: `docs/release/build-staging.md`

**Interfaces:**
- Consumes: updates to `VisitLog.geofence_center` from Tasks 1 and 4.
- Produces: checkout decision based on latest committed visit center; rollout instructions for backend-first deployment and OTA on both runtimes.

- [ ] **Step 1: Write failing checkout tests** showing a later manual/photo center changes an open visit's checkout result, while an existing or completed visit snapshot stays fixed.
- [ ] **Step 2: Run** `php artisan test --filter=VisitRadiusVerificationTest`; expect the new case to fail.
- [ ] **Step 3: Refactor checkout transaction** to lock store then visit (same order as coordinate service), reread current center, and compute status inside that transaction. Preserve idempotent checkout responses.
- [ ] **Step 4: Run** focused tests, then `php artisan test --filter='CrmStoreManagementTest|StoreCoordinateManagementTest|VisitPhotoCoordinateSeedTest|VisitRadiusVerificationTest|StoreCatalogRadiusPreservationTest'`; expect pass.
- [ ] **Step 5: Document** CRM operation, legacy-photo limitation, database migration, and both OTA runtimes. Run `php artisan route:list --path=crm`, `php -l` on changed PHP files, `git diff --check`, and final test suite if configured.
- [ ] **Step 6: Commit** checkout, docs, and tests.

### Task 7: Penyegaran CRM otomatis

**Files:**
- Create: `gps-tracker/app/Http/Controllers/Web/CrmLiveController.php`
- Create: `gps-tracker/public/js/crm-live.js`
- Create: `gps-tracker/tests/Feature/CrmLiveRefreshTest.php`
- Modify: `gps-tracker/routes/web.php`
- Modify: `gps-tracker/resources/views/crm/layout.blade.php`
- Modify: `gps-tracker/resources/views/crm/dashboard.blade.php`
- Modify: `gps-tracker/resources/views/crm/stores/index.blade.php`
- Modify: `gps-tracker/resources/views/crm/stores/show.blade.php`

**Interfaces:**
- Produces: `GET /crm/live-version` JSON `{ version: string }`, scoped to CRM-authenticated roles, derived from latest changes to visits, photos, location pings, stores, users, and SAP coordinate syncs.
- Produces: shared `data-crm-live-root` markup and browser script that checks every 20 seconds while visible, fetches current page HTML only when the version changes, and updates content in place.

- [ ] **Step 1: Write failing feature tests** for protected version route and token changes after visit/photo/store writes; assert CRM pages contain the live root and script.
- [ ] **Step 2: Run** `php artisan test --filter=CrmLiveRefreshTest`; expect failure.
- [ ] **Step 3: Add route/controller** with a cheap version token, then shared browser script. Preserve active dashboard tab, open visit details, filters, scroll, and dirty store form; skip polling in hidden tabs and prevent overlapping requests.
- [ ] **Step 4: Run** focused feature test and manually inspect browser behavior if a local browser is available.
- [ ] **Step 5: Update CRM operation docs** and run `git diff --check`; expect pass.
- [ ] **Step 6: Commit** live-refresh endpoint, script, views, docs, and test.
