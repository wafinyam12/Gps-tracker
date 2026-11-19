# Adaptive Visit Presence and Battery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estimate time Sales spent inside a customer radius during a visit, keep offline samples encrypted, and show a reviewable checkout audit while measuring the battery cost on the pilot phone.

**Architecture:** Laravel owns the customer center/radius snapshot, GPS validation, sample classification, and duration summary. The Expo SDK 54 background location task stores visit samples in existing SQLCipher storage before batch sync and switches between roughly one-minute active-visit and five-minute general tracking. Existing visit endpoints remain compatible. Shared map rendering is traced and fixed based on observed counts.

**Tech Stack:** Laravel 11, MySQL spatial, PHPUnit, Expo SDK 54, expo-location, expo-task-manager, expo-sqlite SQLCipher, Node tests.

**Spec:** `docs/history/designs/2026-11-17-adaptive-visit-presence-and-battery-design.md`

**Progress 18 November:** Task 1–5 selesai di kode lokal. Task 6 direproduksi di HP (14 toko berkoordinat, jalan tampil, marker hilang); akar masalah WebView diperbaiki dan tes lokal lulus, verifikasi setelah OTA menunggu. Task 7: seluruh suite backend 82 lulus/502 assertion dan 75 tes mobile lulus, ekspor Android SDK 54 berhasil; APK Infinix Android 13 serta izin native diperiksa lewat ADB. Empat kegagalan suite sebelumnya dituntaskan, termasuk satu perbaikan penanganan 404 SAP BP dan dua fixture tes. Backend staging, OTA, uji visit dummy, dan perbandingan baterai masih menunggu. Commit tidak tersedia karena `.git/index.lock` ditolak oleh izin lingkungan ini.

## Global Constraints

- Work in the current folder as the user chose. Preserve unrelated dirty CRM web edits; never stage them indiscriminately.
- Customer radius stays within 1–50 m and defaults to 50 m. The first accurate visit point may become a provisional center when the master has no point.
- GPS time in radius is an estimate. Uncertain samples, long gaps, absent permission, and device shutdown are unmeasured, not zero presence.
- Checkout outside the radius completes normally and does not change `counted_as_target`.
- Keep the existing three-day offline replay window, UUID idempotency, encrypted queue/photos, anti-mock rules, and SDK 54 native dependencies.
- Sales 1 is a real UAT account: inspect it read-only. Never create a test visit or change its customer data.
- Backend and migration go to staging before OTA. No new native dependency or permission unless a verified APK check proves it necessary.
- Raw visit samples expire after 30 days; retained visit summaries do not. This is the pilot default pending a different company policy.

## Review Focus

- Cached customer coordinates change before offline sync: preserve a reviewable visit and never silently classify against the stale center.
- A sample UUID replay after timeout: deduplicate by visit and UUID, with no double-counted seconds.
- Checkout arrives before buffered samples: recompute the summary when samples sync and expose provisional status until the final batch arrives.
- An AM asks for another branch's visit ID: return 403 before coordinates or sample metadata are serialized.
- GPS accuracy straddles a 50 m radius: mark uncertain instead of turning a noisy point into definite presence.

---

### Task 1: Backend visit radius snapshot and safe check-in/out

**Files:** `gps-tracker/app/Services/VisitGeofenceService.php`, `gps-tracker/database/migrations/2026_11_17_000000_add_radius_audit_to_visit_logs_table.php`, `gps-tracker/app/Models/VisitLog.php`, `gps-tracker/app/Http/Controllers/Api/CheckInController.php`, `gps-tracker/tests/Unit/VisitGeofenceServiceTest.php`, `gps-tracker/tests/Feature/VisitRadiusVerificationTest.php`.

**Interfaces:** `VisitGeofenceService::startDecision(Store, Point, ?float, bool, ?array): array` returns center/radius/distance/source/status/reject/countable; `checkoutDecision(VisitLog, Point, ?float): array` returns distance/status. Add nullable snapshot, checkout audit, and duration status columns. Existing start/checkout responses add audit keys.

- [ ] Write failing unit and API tests for inside, outside, weak accuracy, unknown center, changed offline reference, UUID replay, outside checkout, and inverted time.
- [ ] Run focused tests and confirm expected failures.
- [ ] Add service, migration, model fields, controller wiring, and additive response keys.
- [ ] Run focused tests plus existing visit regression tests; record results.

### Task 2: Backend sample ingestion and duration estimator

**Files:** new migration for `visit_location_samples` and summary columns, `app/Models/VisitLocationSample.php`, `app/Services/VisitPresenceEstimator.php`, `app/Http/Controllers/Api/VisitLocationSampleController.php`, `routes/api.php`, `tests/Unit/VisitPresenceEstimatorTest.php`, `tests/Feature/VisitLocationSampleApiTest.php`.

**Interfaces:** `POST /api/v1/visits/{visitLog}/samples` accepts up to 100 `{client_uuid, latitude, longitude, accuracy, is_mock_location, recorded_at}` and optional `final_batch`. Owner-only, transactionally inserts unique samples and recomputes the summary. `inside_seconds + outside_seconds + unmeasured_seconds = session_seconds` for completed visits; status `provisional|complete|legacy_unverified`.

- [ ] Write estimator tests for inside/outside/uncertain, two-sample transitions, gaps, out-of-order samples, and no samples; write API tests for owner scope, UUID replay, 3-day time bound, mock, and final batch.
- [ ] Run tests and confirm expected failures.
- [ ] Implement migration, model, estimator, endpoint, and summary recalculation with a visit row lock.
- [ ] Run focused and existing visit tests.

### Task 3: Backend reporting, SAP radius preservation, and retention

**Files:** `app/Http/Controllers/Api/VisitLogController.php`, `app/Http/Controllers/Api/VisitMonitoringController.php`, `app/Services/Crm/CrmAnalyticsService.php`, `resources/views/crm/dashboard.blade.php`, `app/Services/MasterData/StoreCatalogSyncService.php`, `routes/console.php`, focused API/CRM/catalog tests.

**Interfaces:** Scoped visit detail exposes summary and checkout coordinates; scoped list exposes summary without raw samples. SAP refresh retains an existing manually changed radius. Scheduled deletion removes raw samples older than 30 days without deleting visit summaries.

- [ ] Write failing access/report/catalog/retention tests.
- [ ] Run tests and confirm expected failures.
- [ ] Add read-only fields, preserve radius on SAP sync, and schedule raw sample purge.
- [ ] Run focused backend regression suite and inspect dirty CRM hunks.

### Task 4: SDK 54 encrypted visit sampling and adaptive tracking

**Files:** `gps-tracker-mobile/src/utils/backgroundTracker.js`, existing encrypted storage/queue modules, new visit sample queue/helper, `src/context/AuthContext.js` or existing visit state owner, mobile Node tests.

**Interfaces:** A single background visit sampler stores each GPS point encrypted before upload, batches at most 100, resumes after restart, and requests ~60-second high accuracy during an active visit. After checkout it requests ~300-second Balanced general tracking. GPS callbacks must not create duplicate visit samples.

- [ ] Read matching SDK 54 Expo location/task-manager sources and confirm installed APK manifest requirements.
- [ ] Write failing Node tests for mode selection, encrypted queue replay/idempotency, offline failure, and restart recovery.
- [ ] Run tests and confirm expected failures.
- [ ] Implement tracking, queue and lifecycle wiring without adding native dependencies.
- [ ] Run mobile tests and Android JS export.

### Task 5: Sales and Area Manager visit audit UI

**Files:** Sales start/form/audit components, AM read-only visit list/detail screens, API service, navigation, presentation tests.

**Interfaces:** Sales sees in-radius start guidance and after checkout an estimated inside/outside/unmeasured breakdown. AM sees only authorized team visits and checkout coordinate/status. Legacy visits say measurement unavailable. Offline visit says pending sync.

- [ ] Write failing presentation/navigation tests for uncertain, outside checkout, legacy and pending sync.
- [ ] Run tests and confirm expected failures.
- [ ] Add screens and additive UI fields with existing visit theme/padding.
- [ ] Run mobile tests and Android JS export.

### Task 6: Marker diagnosis and repair

**Files:** shared Leaflet WebView, Sales store map, Superadmin/AM live map, focused map tests.

**Interfaces:** Trace API marker count, React Native marker count, WebView map-ready/update acknowledgement, and Leaflet rendered marker count. Sales map uses viewport markers when its 25-row list truncates visible stores. Empty/error states explain why no markers appear.

- [ ] Reproduce and record marker counts on staging/phone; identify the failed boundary.
- [ ] Write a failing test for that cause.
- [ ] Fix only the proven cause and run map/mobile regression tests.

### Task 7: Staging handoff and pilot battery test

**Files:** `docs/release/visit-presence-staging-rollout.md`.

**Interfaces:** Handoff specifies backend file/migration order, API contract, rollback, test matrix, and battery baseline/active visit protocol.

- [ ] Run backend tests on isolated local test DB, mobile Node tests, and SDK 54 Android export.
- [ ] Document staging files and deploy backend first; verify routes and migration before one OTA.
- [ ] With a dummy account/customer, test check-in, screen-locked samples, outside checkout, offline replay, AM detail, and markers. Use Sales 1 only for read-only radius check.
- [ ] Measure baseline versus active visit battery drain on the same Infinix; record samples/gaps and decide whether cadence needs tuning.
- [ ] Review final diff for secrets, native changes, unrelated hunks, and unverified claims.
